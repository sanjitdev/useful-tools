/* ============================================
   fortune-cookie-core.js — Story 10.7 followup
   Discovery Quiz: Fortune Cookie

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  // ----- Inlined QUESTIONS (mirrors data.json) -----
  var QUESTIONS = [
    {
      id: 'q1-crack',
      label: 'First crack',
      prompt: "You crack open the cookie and lift the slip. What's the first thing you notice?",
      options: [
        { value: 'warm',   label: 'How warm the ink feels, almost like it’s thinking' },
        { value: 'sharp',  label: 'That the words are unusually direct' },
        { value: 'soft',   label: 'That it begins softly, like a thought you almost had' },
        { value: 'twist',  label: 'That it ends with a turn you didn’t expect' }
      ]
    },
    {
      id: 'q2-trick',
      label: 'The trick',
      prompt: "A friend swears every fortune in their cookie is a setup. You...",
      options: [
        { value: 'laugh',   label: 'Laugh and crack yours open slowly' },
        { value: 'decode',  label: 'Read it three times until it fits' },
        { value: 'share',   label: 'Compare slips to find the hidden thread' },
        { value: 'flip',    label: 'Turn it over — the back is the real message' }
      ]
    },
    {
      id: 'q3-notebook',
      label: 'The notebook',
      prompt: "You've been collecting fortunes in a notebook for years. What's it become?",
      options: [
        { value: 'mirror',   label: 'A mirror — you can see who you were that year' },
        { value: 'map',      label: 'A map — themes keep circling back to the same streets' },
        { value: 'treasure', label: 'A treasure box you open only on hard mornings' },
        { value: 'game',     label: 'A game — you read them backward for jokes' }
      ]
    },
    {
      id: 'q4-empty',
      label: 'Empty cookie',
      prompt: "You crack one open and there's no slip inside. You...",
      options: [
        { value: 'sign',   label: 'Take it as a sign — silence is the message' },
        { value: 'laugh',  label: 'Laugh and assume the kitchen is having a moment' },
        { value: 'write',  label: 'Write your own fortune, fold it, and slip it back' },
        { value: 'share',  label: 'Pass the empty shell to whoever’s next to you' }
      ]
    },
    {
      id: 'q5-advice',
      label: "Friend's fortune",
      prompt: "A friend's fortune is gloomy. They've read it like it's already true. You...",
      options: [
        { value: 'soften',  label: 'Crack yours open next to theirs as a counterweight' },
        { value: 'reframe', label: 'Point out how fortunes read better sideways' },
        { value: 'story',   label: 'Tell them the one your grandmother always quoted' },
        { value: 'hold',    label: 'Sit with them and let the slip stay where it is' }
      ]
    },
    {
      id: 'q6-tradition',
      label: 'The tradition',
      prompt: 'When you eat the cookie itself, the flavor is...',
      options: [
        { value: 'ritual',  label: 'A ritual that tastes like a small holiday' },
        { value: 'memory',  label: 'A memory of every table you’ve ever sat at' },
        { value: 'treat',   label: 'A treat — the slip is the excuse' },
        { value: 'joke',    label: 'A joke — you’re here for the crumbs and the laughter' }
      ]
    },
    {
      id: 'q7-bad',
      label: 'Bad fortune',
      prompt: "You crack one open: 'You will fail in a way that surprises you.' You...",
      options: [
        { value: 'save',    label: 'Save it — surprises are how you meet yourself' },
        { value: 'reframe', label: 'Re-read it as ‘fail freely, without costume’' },
        { value: 'laugh',   label: 'Crack it in half and read the question mark' },
        { value: 'toss',    label: 'Toss it — some cookies came in a bad mood' }
      ]
    },
    {
      id: 'q8-last',
      label: 'Last cookie',
      prompt: "It's the last cookie from the bag. Who gets the slip?",
      options: [
        { value: 'self',     label: 'Whoever asked first — usually you' },
        { value: 'friend',   label: 'Whoever’s nearest — slips belong in pairs' },
        { value: 'later',    label: 'Whoever needs it later in the week' },
        { value: 'stranger', label: 'Whoever’s forgotten to ask' }
      ]
    }
  ];

  // ----- Inlined SCORING_SPEC (mirrors data.json) -----
  var SCORING_SPEC = {
    traits: ['warmth', 'mischief', 'wisdom', 'surprise'],
    weights: {
      'q1-crack': {
        'warm':   { warmth: 6, wisdom: 2 },
        'sharp':  { wisdom: 5, mischief: 2 },
        'soft':   { warmth: 5, wisdom: 3 },
        'twist':  { surprise: 6, mischief: 2 }
      },
      'q2-trick': {
        'laugh':   { warmth: 4, surprise: 3 },
        'decode':  { wisdom: 6, mischief: 2 },
        'share':   { warmth: 5, wisdom: 2 },
        'flip':    { mischief: 6, surprise: 3 }
      },
      'q3-notebook': {
        'mirror':   { warmth: 5, wisdom: 3 },
        'map':      { wisdom: 6, warmth: 2 },
        'treasure': { warmth: 5, wisdom: 4 },
        'game':     { mischief: 5, surprise: 3 }
      },
      'q4-empty': {
        'sign':    { wisdom: 6, warmth: 2 },
        'laugh':   { warmth: 4, mischief: 3 },
        'write':   { wisdom: 4, surprise: 4 },
        'share':   { warmth: 5, mischief: 2 }
      },
      'q5-advice': {
        'soften':  { warmth: 6, wisdom: 2 },
        'reframe': { wisdom: 5, mischief: 3 },
        'story':   { warmth: 4, wisdom: 4 },
        'hold':    { warmth: 5, wisdom: 3 }
      },
      'q6-tradition': {
        'ritual':  { warmth: 5, wisdom: 3 },
        'memory':  { warmth: 6, wisdom: 2 },
        'treat':   { mischief: 3, warmth: 3 },
        'joke':    { mischief: 6, surprise: 2 }
      },
      'q7-bad': {
        'save':    { wisdom: 5, surprise: 3 },
        'reframe': { wisdom: 5, surprise: 4 },
        'laugh':   { mischief: 5, surprise: 3 },
        'toss':    { mischief: 4, warmth: 2 }
      },
      'q8-last': {
        'self':     { warmth: 2, wisdom: 4 },
        'friend':   { warmth: 6, mischief: 2 },
        'later':    { wisdom: 5, warmth: 3 },
        'stranger': { warmth: 4, surprise: 4 }
      }
    },
    archetypes: [
      {
        id: 'classic', label: 'Classic', emoji: '🥠',
        tagline: 'Warm, plain, and quietly wise — like the slip you save in a coat pocket.',
        blindSpot: 'Familiarity can read as comfort when a sharper edge would help.',
        scores: { warmth: 90, mischief: 40, wisdom: 70, surprise: 35 }
      },
      {
        id: 'zen', label: 'Zen', emoji: '🍵',
        tagline: 'Spare, calm, and certain the empty slip is the point.',
        blindSpot: 'Stillness can become abstention when the room needs a word.',
        scores: { warmth: 60, mischief: 30, wisdom: 90, surprise: 40 }
      },
      {
        id: 'rebels', label: "Rebel's", emoji: '🔥',
        tagline: 'Loud, sharp, and unafraid to tell the cookie it got it wrong.',
        blindSpot: 'Defiance can miss the moment where the small slip was also true.',
        scores: { warmth: 35, mischief: 90, wisdom: 50, surprise: 70 }
      },
      {
        id: 'scholars', label: "Scholar's", emoji: '📜',
        tagline: 'Careful, archival, and curious about what the words actually mean.',
        blindSpot: 'Analysis can outrun the part of the slip that only wants to be felt.',
        scores: { warmth: 50, mischief: 35, wisdom: 90, surprise: 50 }
      },
      {
        id: 'hearts', label: "Heart's", emoji: '💌',
        tagline: 'Soft, generous, and inclined to read love into every line.',
        blindSpot: 'Tenderness can paper over the joke that would have made you both laugh.',
        scores: { warmth: 95, mischief: 35, wisdom: 55, surprise: 45 }
      },
      {
        id: 'tricksters', label: "Trickster's", emoji: '🎭',
        tagline: 'Playful, sideways, and delighted by fortunes that fold back on themselves.',
        blindSpot: 'Cleverness can keep a friend waiting for the real line that never comes.',
        scores: { warmth: 45, mischief: 85, wisdom: 55, surprise: 90 }
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
    warmth: 'Warmth',
    mischief: 'Mischief',
    wisdom: 'Wisdom',
    surprise: 'Surprise'
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
    var QUIZ_SLUG = 'fortune-cookie';
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
            resetBtn.setAttribute('aria-label', 'Reset Fortune Cookie quiz');
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
          try { console.error('fortune-cookie: result render failed:', e); } catch (_) {}
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
