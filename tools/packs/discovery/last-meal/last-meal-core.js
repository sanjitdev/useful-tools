/* ============================================
   last-meal-core.js — Story 10.7 followup
   Discovery Quiz: Last Meal

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  // ----- Inlined QUESTIONS (mirrors data.json) -----
  var QUESTIONS = [
    {
      id: 'q1-table',
      label: 'The table',
      prompt: 'It’s your last meal. Who’s at the table?',
      options: [
        { value: 'alone',   label: 'Just you, with the radio on low' },
        { value: 'chosen',  label: 'Three people, chosen carefully, no agenda' },
        { value: 'full',    label: 'Anyone who can make it — kids, cousins, the loud ones' },
        { value: 'missing', label: 'The people who can’t be there, named and set for' }
      ]
    },
    {
      id: 'q2-room',
      label: 'The room',
      prompt: 'Where do you eat it?',
      options: [
        { value: 'kitchen', label: 'Your grandmother’s kitchen — the same one' },
        { value: 'counter', label: 'A quiet sushi counter with a chef who says little' },
        { value: 'table',   label: 'A long table in a loud, family-run trattoria' },
        { value: 'blanket', label: 'A blanket in a park at the hour the light goes soft' }
      ]
    },
    {
      id: 'q3-clock',
      label: 'The hour',
      prompt: 'What hour of day?',
      options: [
        { value: 'morning',  label: 'Just after sunrise, when the kitchen is still cool' },
        { value: 'noon',     label: 'Midday, the room at its loudest' },
        { value: 'evening',  label: 'Early evening, with candles lit one by one' },
        { value: 'midnight', label: 'Past midnight, at a counter that never closes' }
      ]
    },
    {
      id: 'q4-detail',
      label: 'One detail',
      prompt: 'There’s one detail you’d insist on. Pick it.',
      options: [
        { value: 'salt',    label: 'The salt is passed hand to hand, never left on the table' },
        { value: 'bread',   label: 'Bread that was baked the same morning' },
        { value: 'music',   label: 'The music is a person playing, not a speaker' },
        { value: 'silence', label: 'One full minute of silence before anyone eats' }
      ]
    },
    {
      id: 'q5-drink',
      label: 'What you drink',
      prompt: 'What’s in your glass?',
      options: [
        { value: 'tea',    label: 'Tea in a chipped cup you’ve had since childhood' },
        { value: 'wine',   label: 'A bottle someone brought, opened but not talked up' },
        { value: 'water',  label: 'Cold water, refilled without asking' },
        { value: 'coffee', label: 'Coffee, dark, in a cup you hold the whole meal' }
      ]
    },
    {
      id: 'q6-leftover',
      label: 'The leftover',
      prompt: 'What you do with the leftovers says a lot. You...',
      options: [
        { value: 'box',      label: 'Box them up for whoever left last' },
        { value: 'trash',    label: 'Leave them — this was meant to be finished tonight' },
        { value: 'giveaway', label: 'Hand them to a stranger on the way home' },
        { value: 'recipe',   label: 'Write down the recipe so it can be made again' }
      ]
    },
    {
      id: 'q7-lastbite',
      label: 'The last bite',
      prompt: 'The last bite. You’re...',
      options: [
        { value: 'shared',       label: 'Breaking it in half and giving one piece away' },
        { value: 'savored',      label: 'Holding it in your mouth longer than you need to' },
        { value: 'photographed', label: 'Asking someone to photograph the plate before you finish' },
        { value: 'left',         label: 'Leaving it on the plate, on purpose, so it isn’t gone' }
      ]
    }
  ];

  // ----- Inlined SCORING_SPEC (mirrors data.json) -----
  var SCORING_SPEC = {
    traits: ['simplicity', 'generosity', 'memory', 'indulgence'],
    weights: {
      'q1-table': {
        'alone':   { simplicity: 6, memory: 2 },
        'chosen':  { generosity: 5, memory: 3 },
        'full':    { generosity: 6, indulgence: 2 },
        'missing': { memory: 6, generosity: 2 }
      },
      'q2-room': {
        'kitchen': { memory: 6, generosity: 2 },
        'counter': { simplicity: 6, indulgence: 2 },
        'table':   { indulgence: 5, generosity: 3 },
        'blanket': { simplicity: 4, memory: 4 }
      },
      'q3-clock': {
        'morning':  { simplicity: 5, memory: 3 },
        'noon':     { indulgence: 5, generosity: 2 },
        'evening':  { memory: 5, indulgence: 4 },
        'midnight': { indulgence: 6, simplicity: 2 }
      },
      'q4-detail': {
        'salt':    { simplicity: 4, generosity: 4 },
        'bread':   { memory: 5, simplicity: 3 },
        'music':   { indulgence: 5, generosity: 3 },
        'silence': { simplicity: 5, memory: 4 }
      },
      'q5-drink': {
        'tea':    { memory: 6, simplicity: 2 },
        'wine':   { indulgence: 5, generosity: 3 },
        'water':  { simplicity: 5, generosity: 3 },
        'coffee': { indulgence: 5, simplicity: 3 }
      },
      'q6-leftover': {
        'box':      { generosity: 6, memory: 2 },
        'trash':    { indulgence: 5, simplicity: 3 },
        'giveaway': { generosity: 6, simplicity: 2 },
        'recipe':   { memory: 6, simplicity: 2 }
      },
      'q7-lastbite': {
        'shared':       { generosity: 6, memory: 2 },
        'savored':      { indulgence: 6, memory: 2 },
        'photographed': { memory: 5, indulgence: 4 },
        'left':         { memory: 6, simplicity: 2 }
      }
    },
    archetypes: [
      {
        id: 'grandmother', label: 'Grandmother’s Kitchen', emoji: '🥣',
        tagline: 'A warm, plain table that tastes like every meal you’ve ever been loved at.',
        blindSpot: 'Memory can become a museum when a new kitchen would have been the point.',
        default: true,
        scores: { simplicity: 85, generosity: 75, memory: 90, indulgence: 55 }
      },
      {
        id: 'sushi-counter', label: 'Quiet Sushi Counter', emoji: '🍣',
        tagline: 'A few perfect pieces, eaten slowly, with no one asking how it was.',
        blindSpot: 'Restraint can read as coldness when the table needed a little noise.',
        scores: { simplicity: 90, generosity: 45, memory: 55, indulgence: 75 }
      },
      {
        id: 'trattoria', label: 'Loud Trattoria', emoji: '🍝',
        tagline: 'A long table, second helpings, and a conversation that runs past the candles.',
        blindSpot: 'Generosity can spill over into spectacle when a quiet night would have done.',
        scores: { simplicity: 50, generosity: 90, memory: 60, indulgence: 85 }
      },
      {
        id: 'picnic', label: 'Picnic Blanket', emoji: '🧺',
        tagline: 'A blanket, a paper bag, and an hour the light goes soft in.',
        blindSpot: 'Romance can skip the part where someone still has to pack the bag.',
        scores: { simplicity: 80, generosity: 65, memory: 85, indulgence: 55 }
      },
      {
        id: 'diner', label: 'Midnight Diner', emoji: '🥞',
        tagline: 'A counter that never closes, a stranger who nods, and the comfort of last call.',
        blindSpot: 'Solitude can harden into lonerdom when a table of three would have been warmer.',
        scores: { simplicity: 60, generosity: 50, memory: 55, indulgence: 90 }
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
    simplicity: 'Simplicity',
    generosity: 'Generosity',
    memory: 'Memory',
    indulgence: 'Indulgence'
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
    var QUIZ_SLUG = 'last-meal';
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
            resetBtn.setAttribute('aria-label', 'Reset last meal quiz');
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
          try { console.error('last-meal: result render failed:', e); } catch (_) {}
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
