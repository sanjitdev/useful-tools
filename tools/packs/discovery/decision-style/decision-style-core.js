/* ============================================
   decision-style-core.js — Story 10.7
   Discovery Quiz: Decision Style

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   ============================================ */
'use strict';

(function () {
  var QUESTIONS = [
    { id: 'q1-restaurant', label: 'Restaurant pick',
      prompt: "You're picking a restaurant with friends. You...",
      options: [
        { value: 'quick',  label: 'Pull up a list and pick the top-rated one fast' },
        { value: 'ask',    label: "Ask everyone what they're in the mood for" },
        { value: 'scroll', label: 'Scroll reviews for ten minutes before deciding' },
        { value: 'vibe',   label: 'Walk in the direction that feels right' }
      ] },
    { id: 'q2-job-offer', label: 'Job offer',
      prompt: 'You get a job offer with a deadline in 48 hours.',
      options: [
        { value: 'spreadsheet', label: 'Build a spreadsheet, score the tradeoffs, decide' },
        { value: 'gut',         label: 'Trust your gut on the first read' },
        { value: 'friends',     label: 'Call three friends and talk it through' },
        { value: 'stall',       label: 'Ask for an extension, take the breathing room' }
      ] },
    { id: 'q3-elections', label: 'Election vote',
      prompt: "There's an election next week. How do you decide?",
      options: [
        { value: 'platforms', label: "Read each candidate's platform end-to-end" },
        { value: 'sample',    label: 'Look at a sample ballot and pick positions row by row' },
        { value: 'circle',    label: 'Talk to people in your circle you trust' },
        { value: 'feeling',   label: 'Vote for whoever feels like the right fit' }
      ] },
    { id: 'q4-tech-buy', label: 'Tech purchase',
      prompt: "You're picking a new laptop. Your approach?",
      options: [
        { value: 'specs',  label: 'Compare specs, weight, battery, life of software support' },
        { value: 'review', label: 'Read 3 long reviews, then buy the one that felt best' },
        { value: 'friend', label: 'Ask friends who already have good ones' },
        { value: 'store',  label: 'Walk into a store and pick the one that feels right' }
      ] },
    { id: 'q5-meeting', label: 'Meeting structure',
      prompt: "You're leading a 30-minute meeting. You...",
      options: [
        { value: 'agenda', label: 'Send a tight agenda an hour before' },
        { value: 'open',   label: 'Open the room and let the conversation find a shape' },
        { value: 'decide', label: 'Drive straight to the decision and skip the preamble' },
        { value: 'round',  label: 'Round-robin: hear from everyone before deciding' }
      ] },
    { id: 'q6-crisis', label: 'Crisis call',
      prompt: 'Unexpected bad news arrives at 9pm. Your first move?',
      options: [
        { value: 'act',     label: 'Act on it: fix what you can fix tonight' },
        { value: 'sleep',   label: 'Sleep on it, decide fresh in the morning' },
        { value: 'gather',  label: 'Call the people who need to know' },
        { value: 'analyze', label: 'Write down what you know and what you don\'t' }
      ] },
    { id: 'q7-last-minute', label: 'Last-minute plan',
      prompt: 'A friend proposes a last-minute weekend trip. You...',
      options: [
        { value: 'yes',    label: 'Yes, immediately — figure it out on the way' },
        { value: 'check',  label: 'Check your calendar and budget first' },
        { value: 'ask-us', label: 'Ask whoever else might come what they think' },
        { value: 'draft',  label: 'Draft a quick itinerary before you commit' }
      ] }
  ];

  var SCORING_SPEC = {
    traits: ['speed', 'analysis', 'collaboration', 'spontaneity'],
    weights: {
      'q1-restaurant': {
        'quick':  { speed: 6, analysis: 1 },
        'ask':    { collaboration: 7 },
        'scroll': { analysis: 6 },
        'vibe':   { spontaneity: 7 }
      },
      'q2-job-offer': {
        'spreadsheet': { analysis: 7 },
        'gut':         { spontaneity: 4, speed: 3 },
        'friends':     { collaboration: 7 },
        'stall':       { analysis: 4, collaboration: 2 }
      },
      'q3-elections': {
        'platforms': { analysis: 7 },
        'sample':    { analysis: 5, speed: 2 },
        'circle':    { collaboration: 7 },
        'feeling':   { spontaneity: 6 }
      },
      'q4-tech-buy': {
        'specs':  { analysis: 7 },
        'review': { analysis: 4, spontaneity: 2 },
        'friend': { collaboration: 7 },
        'store':  { spontaneity: 7 }
      },
      'q5-meeting': {
        'agenda': { analysis: 4, collaboration: 2 },
        'open':   { collaboration: 4, spontaneity: 2 },
        'decide': { speed: 7 },
        'round':  { collaboration: 7 }
      },
      'q6-crisis': {
        'act':    { speed: 7 },
        'sleep':  { analysis: 4, spontaneity: 2 },
        'gather': { collaboration: 7 },
        'analyze':{ analysis: 7 }
      },
      'q7-last-minute': {
        'yes':    { speed: 4, spontaneity: 4 },
        'check':  { analysis: 5, speed: 1 },
        'ask-us': { collaboration: 7 },
        'draft':  { analysis: 5, speed: 2 }
      }
    },
    archetypes: [
      { id: 'intuitive', label: 'Intuitive', emoji: '✨',
        tagline: 'You decide the way you taste food — first impression, then go.',
        blindSpot: 'Gut reads can miss the thing that only shows up after a second look.',
        scores: { speed: 45, analysis: 35, collaboration: 30, spontaneity: 90 } },
      { id: 'analytical', label: 'Analytical', emoji: '📊',
        tagline: 'You decide the way you build a model — gather, weight, then commit.',
        blindSpot: 'A perfect model can crowd out the call that needed to be made yesterday.',
        default: true,
        scores: { speed: 25, analysis: 95, collaboration: 30, spontaneity: 20 } },
      { id: 'collaborative', label: 'Collaborative', emoji: '🤝',
        tagline: 'You decide with the room — not by committee, but by listening.',
        blindSpot: 'Listening widely can stall when the call has to land with one person.',
        scores: { speed: 35, analysis: 40, collaboration: 95, spontaneity: 35 } },
      { id: 'spontaneous', label: 'Spontaneous', emoji: '⚡',
        tagline: 'You decide fast and learn fast — the rest is just details.',
        blindSpot: 'Decisions made in motion can land in places you didn\'t quite intend.',
        scores: { speed: 90, analysis: 20, collaboration: 25, spontaneity: 80 } },
      { id: 'deliberative', label: 'Deliberative', emoji: '⚖️',
        tagline: 'You decide carefully — gather, check, then commit and own it.',
        blindSpot: 'Care can shade into over-checking the decisions that didn\'t need it.',
        scores: { speed: 55, analysis: 70, collaboration: 55, spontaneity: 35 } }
    ]
  };

  var TRAIT_LABELS = {
    speed: 'Speed', analysis: 'Analysis', collaboration: 'Collaboration', spontaneity: 'Spontaneity'
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
    var QUIZ_SLUG = 'decision-style';

    var mount = document.getElementById('quiz-mount');
    if (!mount) return;
    if (!window.HT || !window.HT.quiz || typeof window.HT.quiz.open !== 'function') { mount.textContent = 'HT.quiz failed to load.'; return; }
    if (!window.HT.scoring || typeof window.HT.scoring.score !== 'function') { mount.textContent = 'HT.scoring failed to load.'; return; }
    var handle = window.HT.quiz.open({
      mount: mount, questions: QUESTIONS,
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
            resetBtn.setAttribute('aria-label', 'Reset decision style quiz');
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
          try { console.error('decision-style: result render failed:', e); } catch (_) {}
        });
      }
    });
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
