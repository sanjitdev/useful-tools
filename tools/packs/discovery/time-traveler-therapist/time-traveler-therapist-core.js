/* ============================================
   time-traveler-therapist-core.js — Story 10.7 followup
   Discovery Quiz: Time-Traveler Therapist

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  // ----- Inlined QUESTIONS (mirrors data.json) -----
  var QUESTIONS = [
    {
      id: 'q1-walkin',
      label: 'Walk-in',
      prompt: 'A patient from 1923 walks into your office. What’s your first question?',
      options: [
        { value: 'context',  label: '"Tell me what brought you here in your own words."' },
        { value: 'senses',   label: '"What’s the loudest thing you noticed on the way in?"' },
        { value: 'bridge',   label: '"Tell me one thing that’s the same as the year you left."' },
        { value: 'offer',    label: '"Sit. I’ll explain the world as it is now, in a moment."' }
      ]
    },
    {
      id: 'q2-language',
      label: 'The new language',
      prompt: 'The patient keeps using a word that doesn’t exist yet. You...',
      options: [
        { value: 'guess',    label: 'Guess what they mean from how they say it' },
        { value: 'ask',      label: 'Ask them to define it as if teaching a child' },
        { value: 'reflect',  label: 'Reflect the word back and watch their eyes' },
        { value: 'name',     label: 'Name a modern word that almost fits' }
      ]
    },
    {
      id: 'q3-cure',
      label: 'The “cure”',
      prompt: 'They ask what medicine cures loneliness. You...',
      options: [
        { value: 'honest',   label: 'Tell them honestly: it doesn’t, but it gets quieter' },
        { value: 'story',    label: 'Tell them about a place in their century that helped' },
        { value: 'ritual',   label: 'Suggest one small ritual, every morning, for a week' },
        { value: 'imagine',  label: 'Imagine their answer with them out loud' }
      ]
    },
    {
      id: 'q4-letter',
      label: 'Letter home',
      prompt: 'They want to write a letter to someone they left behind. You...',
      options: [
        { value: 'help',     label: 'Help them write it in their own handwriting' },
        { value: 'edit',     label: 'Gently edit out what they don’t mean yet' },
        { value: 'wait',     label: 'Wait until the silence in them settles first' },
        { value: 'postpone', label: 'Suggest they keep it folded until tomorrow' }
      ]
    },
    {
      id: 'q5-tablet',
      label: 'The tablet',
      prompt: 'You show them a tablet screen. They ask what it costs the soul. You...',
      options: [
        { value: 'balance',  label: 'Talk about what it gives before what it takes' },
        { value: 'caution',  label: 'Warn them about the part that’s almost free' },
        { value: 'tradeoff', label: 'Ask them to list one thing it replaces' },
        { value: 'wonder',   label: 'Wonder aloud what their century would have invented instead' }
      ]
    },
    {
      id: 'q6-future',
      label: 'Future patient',
      prompt: 'A patient from 2125 arrives next. Your first instinct is to...',
      options: [
        { value: 'prepare',  label: 'Prepare by rereading everything I’ve learned' },
        { value: 'ask',      label: 'Ask the 1923 patient to stay and translate' },
        { value: 'listen',   label: 'Listen longer than I plan to talk' },
        { value: 'imagine',  label: 'Imagine their first breath on our air' }
      ]
    },
    {
      id: 'q7-silence',
      label: 'Silence',
      prompt: 'There’s a long silence in the session. You...',
      options: [
        { value: 'hold',     label: 'Hold the silence and trust what it’s doing' },
        { value: 'name',     label: 'Name the silence so they can choose what it is' },
        { value: 'small',    label: 'Offer a small question that opens a door sideways' },
        { value: 'story',    label: 'Tell them a story about silence from another era' }
      ]
    },
    {
      id: 'q8-goodbye',
      label: 'Goodbye',
      prompt: 'It’s time for them to return. The room feels heavy. You...',
      options: [
        { value: 'ritual',   label: 'Make a small ritual of the leaving — a sentence, a cup of tea' },
        { value: 'ground',   label: 'Ground them in the next concrete thing they’ll see' },
        { value: 'truth',    label: 'Tell them a true thing that took you years to learn' },
        { value: 'follow',   label: 'Ask to follow, just to the door, just to the street' }
      ]
    },
    {
      id: 'q9-note',
      label: 'Case note',
      prompt: 'In your private case note, you write...',
      options: [
        { value: 'symptom',  label: 'What they told me, almost verbatim' },
        { value: 'myself',   label: 'What I noticed about myself in the session' },
        { value: 'theory',   label: 'The theory that fits, even if it isn’t mine' },
        { value: 'metaphor', label: 'A metaphor I can return to next time' }
      ]
    },
    {
      id: 'q10-hours',
      label: 'Office hours',
      prompt: 'After they leave, your office hours feel different. You...',
      options: [
        { value: 'close',     label: 'Close the books and walk the long way home' },
        { value: 'research',  label: 'Research everything you assumed but didn’t check' },
        { value: 'wait',      label: 'Sit with what happened, without trying to use it' },
        { value: 'document',  label: 'Document the room’s exact temperature and light' }
      ]
    }
  ];

  // ----- Inlined SCORING_SPEC (mirrors data.json) -----
  var SCORING_SPEC = {
    traits: ['curiosity', 'empathy', 'imagination', 'pragmatism'],
    weights: {
      'q1-walkin': {
        'context':  { empathy: 5, pragmatism: 2 },
        'senses':   { imagination: 5, curiosity: 3 },
        'bridge':   { empathy: 4, imagination: 3 },
        'offer':    { pragmatism: 5, empathy: 2 }
      },
      'q2-language': {
        'guess':    { imagination: 4, curiosity: 3 },
        'ask':      { pragmatism: 5, empathy: 2 },
        'reflect':  { empathy: 6, imagination: 2 },
        'name':     { curiosity: 5, pragmatism: 3 }
      },
      'q3-cure': {
        'honest':   { pragmatism: 5, empathy: 3 },
        'story':    { imagination: 5, empathy: 3 },
        'ritual':   { pragmatism: 5, empathy: 3 },
        'imagine':  { imagination: 6, empathy: 2 }
      },
      'q4-letter': {
        'help':     { empathy: 5, pragmatism: 3 },
        'edit':     { pragmatism: 5, empathy: 2 },
        'wait':     { empathy: 5, imagination: 2 },
        'postpone': { pragmatism: 4, empathy: 3 }
      },
      'q5-tablet': {
        'balance':  { pragmatism: 5, empathy: 2 },
        'caution':  { pragmatism: 5, empathy: 3 },
        'tradeoff': { pragmatism: 6, curiosity: 2 },
        'wonder':   { imagination: 5, curiosity: 3 }
      },
      'q6-future': {
        'prepare':  { pragmatism: 6, curiosity: 2 },
        'ask':      { empathy: 5, pragmatism: 2 },
        'listen':   { empathy: 5, curiosity: 3 },
        'imagine':  { imagination: 6, empathy: 2 }
      },
      'q7-silence': {
        'hold':     { empathy: 6, pragmatism: 2 },
        'name':     { pragmatism: 4, empathy: 4 },
        'small':    { curiosity: 4, pragmatism: 4 },
        'story':    { imagination: 5, empathy: 3 }
      },
      'q8-goodbye': {
        'ritual':   { empathy: 4, pragmatism: 4 },
        'ground':   { pragmatism: 6, empathy: 2 },
        'truth':    { curiosity: 4, empathy: 4 },
        'follow':   { empathy: 6, imagination: 2 }
      },
      'q9-note': {
        'symptom':  { pragmatism: 5, empathy: 2 },
        'myself':   { empathy: 5, curiosity: 3 },
        'theory':   { pragmatism: 4, curiosity: 4 },
        'metaphor': { imagination: 6, curiosity: 2 }
      },
      'q10-hours': {
        'close':     { empathy: 4, imagination: 4 },
        'research':  { pragmatism: 5, curiosity: 4 },
        'wait':      { empathy: 5, imagination: 3 },
        'document':  { pragmatism: 6, curiosity: 2 }
      }
    },
    archetypes: [
      {
        id: 'counselor', label: 'Counselor', emoji: '🛋️',
        tagline: 'Steady, attuned, and willing to sit in silence longer than anyone else.',
        blindSpot: 'Empathic attunement can become emotional enmeshment when the patient leaves.',
        default: true,
        scores: { curiosity: 50, empathy: 90, imagination: 55, pragmatism: 50 }
      },
      {
        id: 'historian', label: 'Historian', emoji: '📜',
        tagline: 'Curious about the smallest detail and what the patient assumed was ordinary.',
        blindSpot: 'Fascination with context can delay the moment the patient actually needed a word.',
        scores: { curiosity: 90, empathy: 55, imagination: 60, pragmatism: 50 }
      },
      {
        id: 'storyteller', label: 'Storyteller', emoji: '📖',
        tagline: 'Reaches for a metaphor that lets the patient finish the sentence themselves.',
        blindSpot: 'A good story can outrun the patient’s actual question.',
        scores: { curiosity: 60, empathy: 65, imagination: 90, pragmatism: 40 }
      },
      {
        id: 'scientist', label: 'Scientist', emoji: '🔬',
        tagline: 'Asks for definitions, tests hypotheses, and refuses to guess in the dark.',
        blindSpot: 'Method can become a wall when the patient needs to be believed, not studied.',
        scores: { curiosity: 80, empathy: 40, imagination: 50, pragmatism: 90 }
      },
      {
        id: 'mystic', label: 'Mystic', emoji: '🌌',
        tagline: 'Hears the silence as a room of its own and treats it like a co-therapist.',
        blindSpot: 'Wonder can be its own avoidance of the small concrete thing the patient came in for.',
        scores: { curiosity: 65, empathy: 60, imagination: 80, pragmatism: 35 }
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
    curiosity: 'Curiosity',
    empathy: 'Empathy',
    imagination: 'Imagination',
    pragmatism: 'Pragmatism'
  };

  // ----- Reveal panel -----


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

        // Story 10.12 — if the URL carries ?c=<blob>, mount the
    // receiver-side challenge banner above the quiz. Privacy
    // default: blind.
    var QUIZ_SLUG = 'time-traveler-therapist';
    if (window.HT.challengeReceiver) {
      var r = window.HT.challengeReceiver.landing(QUIZ_SLUG, mount.parentNode, {});
      if (r && r.ok) {
        // Continue to mount the quiz below the banner.
      }}

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
            resetBtn.setAttribute('aria-label', 'Reset Time Traveler Therapist quiz');
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
          try { console.error('time-traveler-therapist: result render failed:', e); } catch (_) {}
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
