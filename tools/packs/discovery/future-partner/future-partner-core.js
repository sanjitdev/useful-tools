/* ============================================
   future-partner-core.js — Story 10.7
   Discovery Quiz: Future Partner

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  var QUESTIONS = [
    {
      id: 'q1-morning', label: 'Morning together',
      prompt: 'A slow morning together. What feels most like home?',
      options: [
        { value: 'tea',      label: 'Tea and a long walk with no phones' },
        { value: 'ambition', label: 'Coffee and a shared to-do list' },
        { value: 'joke',     label: 'Coffee and a long inside-joke warmup' },
        { value: 'discover', label: 'Tea and a podcast you keep pausing to discuss' }
      ]
    },
    {
      id: 'q2-conflict', label: 'Disagreement',
      prompt: 'When you disagree, what do you most want from them?',
      options: [
        { value: 'warmth',    label: 'Soft hands, a softer voice' },
        { value: 'loyalty',   label: 'Steady presence, no exit threats' },
        { value: 'humor',     label: 'A well-timed joke that breaks the heat' },
        { value: 'curiosity', label: 'A real question about why I think that' }
      ]
    },
    {
      id: 'q3-dinner', label: 'Dream dinner',
      prompt: 'Pick a fantasy dinner setting.',
      options: [
        { value: 'intimate', label: 'Tiny corner table, candle, just us' },
        { value: 'host',     label: 'Big table, friends everywhere, second rounds' },
        { value: 'fancy',    label: 'Quiet tasting menu, chef\'s choice, no menu' },
        { value: 'kitchen',  label: 'Cooking it together, music, flour on the counter' }
      ]
    },
    {
      id: 'q4-weekend', label: 'Empty weekend',
      prompt: 'An empty weekend. What does it become?',
      options: [
        { value: 'explore', label: 'A new neighborhood, no plan, just wander' },
        { value: 'build',   label: 'A side project, side by side, headphones optional' },
        { value: 'decline', label: 'A long nap, a slow brunch, then nothing' },
        { value: 'people',  label: 'A house full of friends, someone brings a guitar' }
      ]
    },
    {
      id: 'q5-ambition', label: 'Their ambition',
      prompt: 'What ambition in them do you find most attractive?',
      options: [
        { value: 'build', label: 'Building something that outlives them' },
        { value: 'learn', label: 'Always learning, always curious' },
        { value: 'lead',  label: 'Leading teams, making hard calls without flinching' },
        { value: 'care',  label: 'Caring for the people closest to them' }
      ]
    },
    {
      id: 'q6-hard-day', label: 'They had a hard day',
      prompt: 'They had a rough day. What do you do?',
      options: [
        { value: 'hold',  label: 'Hold them, not say much, just be there' },
        { value: 'solve', label: 'Help them actually fix the thing' },
        { value: 'laugh', label: 'Distract them with something silly until the tension lifts' },
        { value: 'talk',  label: 'Ask good questions until they hear themselves' }
      ]
    },
    {
      id: 'q7-trip', label: 'Big trip',
      prompt: 'Two weeks of travel together. What\'s the dream?',
      options: [
        { value: 'deep',   label: 'Two cities, slow, no checklist' },
        { value: 'wild',   label: 'Last-minute tickets, see where the bus goes' },
        { value: 'plan',   label: 'Everything booked, every day has a plan' },
        { value: 'people', label: 'Visiting people we know in every stop' }
      ]
    },
    {
      id: 'q8-humor', label: 'Sense of humor',
      prompt: 'The kind of humor that wins you over is...',
      options: [
        { value: 'dry',    label: 'Dry, deadpan, almost too quiet' },
        { value: 'absurd', label: 'Absurd, silly, the dumber the better' },
        { value: 'banter', label: 'Fast banter, callbacks, sharp timing' },
        { value: 'warm',   label: 'Warm teasing that we\'d both laugh at' }
      ]
    },
    {
      id: 'q9-loyalty', label: 'Loyalty test',
      prompt: 'What shows you they\'re loyal over time?',
      options: [
        { value: 'small',  label: 'They remember the small things you mentioned once' },
        { value: 'defend', label: 'They defend you when you aren\'t in the room' },
        { value: 'stays',  label: 'They stay when things are hard, not just when they\'re good' },
        { value: 'shows',  label: 'They show up. Consistently. Without being asked' }
      ]
    },
    {
      id: 'q10-curiosity', label: 'Curiosity',
      prompt: 'What kind of curiosity do you most want to share?',
      options: [
        { value: 'ideas',  label: 'Big ideas, late nights, half-formed theories' },
        { value: 'people', label: 'How people work, why they do what they do' },
        { value: 'world',  label: 'Places, languages, food, the wider world' },
        { value: 'skills', label: 'Hands-on skills, building, crafting, making' }
      ]
    }
  ];

  var SCORING_SPEC = {
    traits: ['warmth', 'ambition', 'humor', 'loyalty', 'curiosity'],
    weights: {
      'q1-morning': {
        'tea':      { warmth: 5, curiosity: 2 },
        'ambition': { ambition: 6, loyalty: 1 },
        'joke':     { humor: 6, warmth: 1 },
        'discover': { curiosity: 5, warmth: 2 }
      },
      'q2-conflict': {
        'warmth':    { warmth: 6 },
        'loyalty':   { loyalty: 6 },
        'humor':     { humor: 6 },
        'curiosity': { curiosity: 6, warmth: 2 }
      },
      'q3-dinner': {
        'intimate': { warmth: 5, loyalty: 2 },
        'host':     { warmth: 3, humor: 3 },
        'fancy':    { curiosity: 4, ambition: 2 },
        'kitchen':  { warmth: 4, humor: 3 }
      },
      'q4-weekend': {
        'explore': { curiosity: 5, warmth: 1 },
        'build':   { ambition: 5, loyalty: 2 },
        'decline': { warmth: 2, loyalty: 4 },
        'people':  { warmth: 4, humor: 4 }
      },
      'q5-ambition': {
        'build': { ambition: 6, curiosity: 2 },
        'learn': { curiosity: 6, ambition: 2 },
        'lead':  { ambition: 7 },
        'care':  { warmth: 6, loyalty: 2 }
      },
      'q6-hard-day': {
        'hold':  { warmth: 6, loyalty: 2 },
        'solve': { ambition: 5, loyalty: 2 },
        'laugh': { humor: 6, warmth: 1 },
        'talk':  { curiosity: 5, warmth: 2 }
      },
      'q7-trip': {
        'deep':   { warmth: 4, curiosity: 3 },
        'wild':   { curiosity: 4, humor: 3 },
        'plan':   { ambition: 4, loyalty: 2 },
        'people': { warmth: 5, humor: 2 }
      },
      'q8-humor': {
        'dry':    { humor: 5, curiosity: 2 },
        'absurd': { humor: 6 },
        'banter': { humor: 6, curiosity: 1 },
        'warm':   { humor: 4, warmth: 4 }
      },
      'q9-loyalty': {
        'small':  { warmth: 5, curiosity: 2 },
        'defend': { loyalty: 6, warmth: 1 },
        'stays':  { loyalty: 7 },
        'shows':  { loyalty: 5, warmth: 3 }
      },
      'q10-curiosity': {
        'ideas':  { curiosity: 5, ambition: 2 },
        'people': { curiosity: 5, warmth: 2 },
        'world':  { curiosity: 6 },
        'skills': { curiosity: 5, ambition: 2 }
      }
    },
    archetypes: [
      { id: 'cozy-companion', label: 'The Cozy Companion', emoji: '🛋️',
        tagline: 'Warm, steady, and grounded in the everyday stuff.',
        blindSpot: 'Stability can curdle into routine if no one shakes things up.',
        scores: { warmth: 90, ambition: 30, humor: 40, loyalty: 75, curiosity: 45 } },
      { id: 'co-conspirator', label: 'The Co-Conspirator', emoji: '🤝',
        tagline: 'Loyal, ambitious, and ready to build something together.',
        blindSpot: 'All-in loyalty can blur the lines when compromise is needed.',
        scores: { warmth: 60, ambition: 90, humor: 45, loyalty: 85, curiosity: 50 } },
      { id: 'jester', label: 'The Jester', emoji: '🎭',
        tagline: 'Quick, witty, and the kind of funny that makes a Tuesday feel like a holiday.',
        blindSpot: 'Humor can dodge the harder conversations when they actually need to happen.',
        scores: { warmth: 50, ambition: 35, humor: 95, loyalty: 50, curiosity: 55 } },
      { id: 'curious-stranger', label: 'The Curious Stranger', emoji: '🧭',
        tagline: 'Always asking, always wandering, always bringing the world home.',
        blindSpot: 'Novelty can crowd out the deep, slow work of staying close.',
        scores: { warmth: 45, ambition: 50, humor: 55, loyalty: 40, curiosity: 95 } },
      { id: 'steady-flame', label: 'The Steady Flame', emoji: '🕯️',
        tagline: 'Warm, loyal, and reliably present in good seasons and hard ones.',
        blindSpot: 'Showing up for others can crowd out showing up for yourself.',
        default: true,
        scores: { warmth: 80, ambition: 35, humor: 40, loyalty: 90, curiosity: 35 } },
      { id: 'renaissance-match', label: 'The Renaissance Match', emoji: '🎨',
        tagline: 'Curious, warm, and full of side projects you want to hear about.',
        blindSpot: 'Spreading wide can leave the everyday a little thin.',
        scores: { warmth: 65, ambition: 60, humor: 65, loyalty: 55, curiosity: 80 } }
    ]
  };

  var TRAIT_LABELS = {
    warmth: 'Warmth', ambition: 'Ambition', humor: 'Humor',
    loyalty: 'Loyalty', curiosity: 'Curiosity'
  };

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





  function boot() {
    var QUIZ_SLUG = 'future-partner';

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
      onChange: function () {},
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
            resetBtn.setAttribute('aria-label', 'Reset future partner quiz');
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
          try { console.error('future-partner: result render failed:', e); } catch (_) {}
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
