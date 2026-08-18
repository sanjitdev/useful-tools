/* ============================================
   dream-job-core.js — Story 10.7 followup
   Discovery Quiz: Dream Job

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  // ----- Inlined QUESTIONS (mirrors data.json) -----
  var QUESTIONS = [
    {
      id: 'q1-workspace',
      label: 'Workspace',
      prompt: 'You get to design your workspace. Pick the closest fit.',
      options: [
        { value: 'studio',  label: 'A studio with one long table and your tools laid out' },
        { value: 'office',  label: 'A quiet office with a door that closes' },
        { value: 'field',   label: 'No desk at all — you’re rarely in the same place twice' },
        { value: 'kitchen', label: 'A shared kitchen, with a corkboard for half-finished ideas' }
      ]
    },
    {
      id: 'q2-meeting',
      label: 'Meeting',
      prompt: 'How do you most hate to meet?',
      options: [
        { value: 'weekly',    label: 'The standing weekly that could be an email' },
        { value: 'pitch',     label: 'The pitch meeting where the room has already decided' },
        { value: '1on1',      label: 'The 1:1 that turns into a confession booth' },
        { value: 'townhall',  label: 'The town hall where your work is mentioned in passing' }
      ]
    },
    {
      id: 'q3-deadline',
      label: 'Deadline',
      prompt: 'What’s the best kind of deadline?',
      options: [
        { value: 'yesterday', label: 'The one that was yesterday — you finish under pressure' },
        { value: 'long',      label: 'The one that’s three months out, for the slow craft' },
        { value: 'none',      label: 'None — you set your own and quietly keep them' },
        { value: 'external',  label: 'The one a stakeholder will notice if you miss' }
      ]
    },
    {
      id: 'q4-tradeoff',
      label: 'The trade-off',
      prompt: 'Pay doubles, but the work is less yours. You...',
      options: [
        { value: 'take',      label: 'Take it for a season, keep the craft private' },
        { value: 'decline',   label: 'Decline — the work is the point' },
        { value: 'negotiate', label: 'Negotiate so the work stays half yours' },
        { value: 'side',      label: 'Take it, and start the real thing on the side' }
      ]
    },
    {
      id: 'q5-praise',
      label: 'Praise',
      prompt: 'The praise that lands best is...',
      options: [
        { value: 'public',  label: 'A public thank-you, in front of people who matter' },
        { value: 'private', label: 'A private note, years later, from someone you helped' },
        { value: 'repeat',  label: 'A repeat customer who comes back without a coupon' },
        { value: 'quiet',   label: 'The kind no one writes down, but everyone uses' }
      ]
    },
    {
      id: 'q6-team',
      label: 'Team',
      prompt: 'Your ideal team is...',
      options: [
        { value: 'solo',  label: 'Mostly you, with one sharp collaborator' },
        { value: 'pair',  label: 'Two of you, doing everything' },
        { value: 'small', label: 'A small pod of four to seven, with shared rituals' },
        { value: 'guild', label: 'A loose guild that comes together for projects' }
      ]
    },
    {
      id: 'q7-hard',
      label: 'Hard part',
      prompt: 'The hardest part of a job is...',
      options: [
        { value: 'politics',  label: 'Politics — who’s upstream of whom' },
        { value: 'precision', label: 'Precision — the part that has to be right by Tuesday' },
        { value: 'ambiguity', label: 'Ambiguity — five equally good ways, no map' },
        { value: 'lonely',    label: 'Loneliness — being the only one who cares about the small thing' }
      ]
    },
    {
      id: 'q8-evening',
      label: 'After hours',
      prompt: 'After a good day at work, you...',
      options: [
        { value: 'tinker', label: 'Tinker on a side project until it gets good' },
        { value: 'read',   label: 'Read something that has nothing to do with the work' },
        { value: 'people', label: 'Talk to people who don’t know what your job is' },
        { value: 'walk',   label: 'Walk until the day’s shape is gone' }
      ]
    },
    {
      id: 'q9-monday',
      label: 'Monday morning',
      prompt: 'Monday morning. What’s the most you hope for?',
      options: [
        { value: 'stability', label: 'Predictable, with one small surprise' },
        { value: 'project',   label: 'A new project you’d choose again' },
        { value: 'use',       label: 'A chance to be useful in a way only you would notice' },
        { value: 'freedom',   label: 'Wide-open time, and the discipline to use it' }
      ]
    }
  ];

  // ----- Inlined SCORING_SPEC (mirrors data.json) -----
  var SCORING_SPEC = {
    traits: ['autonomy', 'craft', 'impact', 'stability'],
    weights: {
      'q1-workspace': {
        'studio':  { craft: 6, autonomy: 3 },
        'office':  { stability: 5, autonomy: 3 },
        'field':   { autonomy: 6, impact: 2 },
        'kitchen': { impact: 4, craft: 3 }
      },
      'q2-meeting': {
        'weekly':   { stability: 4, craft: 2 },
        'pitch':    { autonomy: 5, impact: 3 },
        '1on1':     { impact: 5, stability: 2 },
        'townhall': { impact: 4, autonomy: 3 }
      },
      'q3-deadline': {
        'yesterday': { autonomy: 4, impact: 3 },
        'long':      { craft: 6, stability: 2 },
        'none':      { autonomy: 6, craft: 2 },
        'external':  { impact: 5, stability: 3 }
      },
      'q4-tradeoff': {
        'take':      { stability: 5, impact: 2 },
        'decline':   { craft: 6, autonomy: 2 },
        'negotiate': { autonomy: 5, craft: 3 },
        'side':      { craft: 5, autonomy: 4 }
      },
      'q5-praise': {
        'public':  { impact: 5, stability: 2 },
        'private': { craft: 5, impact: 3 },
        'repeat':  { craft: 6, stability: 2 },
        'quiet':   { craft: 6, autonomy: 2 }
      },
      'q6-team': {
        'solo':  { autonomy: 6, craft: 2 },
        'pair':  { craft: 5, autonomy: 3 },
        'small': { stability: 4, impact: 4 },
        'guild': { autonomy: 4, impact: 4 }
      },
      'q7-hard': {
        'politics':  { impact: 3, stability: 4 },
        'precision': { craft: 6, stability: 2 },
        'ambiguity': { autonomy: 5, craft: 3 },
        'lonely':    { craft: 5, autonomy: 3 }
      },
      'q8-evening': {
        'tinker': { craft: 6, autonomy: 2 },
        'read':   { craft: 4, autonomy: 4 },
        'people': { impact: 5, autonomy: 2 },
        'walk':   { stability: 4, autonomy: 4 }
      },
      'q9-monday': {
        'stability': { stability: 6, craft: 2 },
        'project':   { craft: 5, autonomy: 3 },
        'use':       { impact: 6, craft: 2 },
        'freedom':   { autonomy: 6, craft: 2 }
      }
    },
    archetypes: [
      {
        id: 'artisan', label: 'Artisan', emoji: '🛠️',
        tagline: 'The work has to be right, and you’d rather do it slowly than badly.',
        blindSpot: 'Craft can become a private religion when the room needs a finished thing.',
        default: true,
        scores: { autonomy: 65, craft: 90, impact: 50, stability: 50 }
      },
      {
        id: 'pioneer', label: 'Pioneer', emoji: '🧭',
        tagline: 'Builds the road by walking it, and prefers the path that hasn’t been drawn yet.',
        blindSpot: 'Pioneering can mistake novelty for value when a tired road was fine.',
        scores: { autonomy: 95, craft: 60, impact: 65, stability: 30 }
      },
      {
        id: 'steward', label: 'Steward', emoji: '🏛️',
        tagline: 'Keeps the institution honest — the kind that notices what’s quietly drifting.',
        blindSpot: 'Stewardship can become the thing no one thanks you for, until it breaks.',
        scores: { autonomy: 50, craft: 60, impact: 70, stability: 90 }
      },
      {
        id: 'scholar', label: 'Scholar', emoji: '📚',
        tagline: 'Measures twice, returns to the source, and treats the work as a long argument.',
        blindSpot: 'Scholarly patience can read as hesitation when the room needs a verdict.',
        scores: { autonomy: 70, craft: 80, impact: 55, stability: 60 }
      },
      {
        id: 'diplomat', label: 'Diplomat', emoji: '🤝',
        tagline: 'Holds the room together, translates between floors, and remembers who said what.',
        blindSpot: 'Diplomacy can keep the peace past the point where a clean break would help.',
        scores: { autonomy: 45, craft: 55, impact: 85, stability: 75 }
      },
      {
        id: 'maverick', label: 'Maverick', emoji: '🐎',
        tagline: 'Wants the wide-open room, the stubborn brief, and the permission to break the format.',
        blindSpot: 'Independence can leave a small mess for someone else to clean up on Monday.',
        scores: { autonomy: 90, craft: 70, impact: 60, stability: 35 }
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
    autonomy: 'Autonomy',
    craft: 'Craft',
    impact: 'Impact',
    stability: 'Stability'
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
    var QUIZ_SLUG = 'dream-job';
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
            resetBtn.setAttribute('aria-label', 'Reset Dream Job quiz');
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
          try { console.error('dream-job: result render failed:', e); } catch (_) {}
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
