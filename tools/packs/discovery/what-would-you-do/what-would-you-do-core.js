/* ============================================
   what-would-you-do-core.js — Story 10.7
   Discovery Quiz: What Would You Do

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  var QUESTIONS = [
    { id: 'q1-find-wallet', label: 'Found a wallet',
      prompt: 'You find a wallet on the sidewalk with cash and an ID inside.',
      options: [
        { value: 'return', label: 'Track down the owner and return it' },
        { value: 'drop',   label: 'Drop it at the nearest shop counter, leave a note' },
        { value: 'police', label: 'Hand it to the police station on the next block' },
        { value: 'walk',   label: 'Leave it where it is; someone will come back' }
      ] },
    { id: 'q2-stranger-help', label: 'Stranger needs help',
      prompt: 'A stranger at a coffee shop looks lost and asks for directions.',
      options: [
        { value: 'walk-them', label: 'Walk them to the right bus stop' },
        { value: 'phone',     label: 'Pull up a map on your phone and explain' },
        { value: 'quick',     label: 'Give them quick verbal directions and wish them luck' },
        { value: 'staff',     label: 'Point them to a staff member who knows the area' }
      ] },
    { id: 'q3-team-conflict', label: 'Team disagreement',
      prompt: 'Your team is split on a decision. The deadline is tomorrow.',
      options: [
        { value: 'call',     label: 'Call a short meeting and force a call today' },
        { value: 'vote',     label: 'Take a quick vote and move on' },
        { value: 'research', label: 'Spend an hour researching the right answer' },
        { value: 'defer',    label: 'Defer to whoever has the most experience' }
      ] },
    { id: 'q4-lost-dog', label: 'Lost dog',
      prompt: "A neighbor's dog is loose and heading toward a busy road.",
      options: [
        { value: 'chase',    label: "Run after it, don't stop until it's safe" },
        { value: 'call-out', label: 'Call the dog by name and use treats if you have any' },
        { value: 'block',    label: 'Position yourself to block its path calmly' },
        { value: 'alert',    label: "Knock on the neighbor's door first" }
      ] },
    { id: 'q5-friend-asks-money', label: 'Friend asks for money',
      prompt: 'A friend asks to borrow a meaningful amount of money.',
      options: [
        { value: 'yes',     label: 'Yes, on the spot, no questions' },
        { value: 'ask',     label: 'Yes, but ask what it\'s for first' },
        { value: 'plan',    label: 'Propose a clear repayment plan before saying yes' },
        { value: 'soft-no', label: "Politely say no, explain you can't right now" }
      ] },
    { id: 'q6-new-hobby', label: 'New hobby',
      prompt: "You see a class for something you've always wanted to try.",
      options: [
        { value: 'sign-up',  label: 'Sign up today, no hesitation' },
        { value: 'research', label: 'Research the teacher, the price, the time' },
        { value: 'watch',    label: 'Watch a free intro class first, then decide' },
        { value: 'later',    label: 'Save the link for later' }
      ] },
    { id: 'q7-news-headline', label: 'Big news headline',
      prompt: 'A big news story drops. Your first move?',
      options: [
        { value: 'share', label: 'Share it with a friend who cares about the topic' },
        { value: 'read',  label: 'Read multiple sources before saying anything' },
        { value: 'act',   label: 'Take action — donate, sign, volunteer' },
        { value: 'wait',  label: 'Wait a day to see how the story develops' }
      ] },
    { id: 'q8-farewell', label: 'Friend is leaving',
      prompt: 'A close friend is moving abroad for a year.',
      options: [
        { value: 'party',       label: 'Throw them a big going-away party' },
        { value: 'one-on-one',  label: 'Take them out for a quiet one-on-one dinner' },
        { value: 'pledge',      label: 'Pledge weekly video calls and book a visit' },
        { value: 'note',        label: 'Write them a long letter to open on the plane' }
      ] }
  ];

  var SCORING_SPEC = {
    traits: ['bold', 'cautious', 'curious', 'compassionate'],
    weights: {
      'q1-find-wallet': {
        'return': { compassionate: 6, curious: 2 },
        'drop':   { cautious: 4, compassionate: 3 },
        'police': { cautious: 6, curious: 1 },
        'walk':   { cautious: 5 }
      },
      'q2-stranger-help': {
        'walk-them': { compassionate: 6, bold: 1 },
        'phone':     { cautious: 4, curious: 3 },
        'quick':     { cautious: 3, bold: 2 },
        'staff':     { cautious: 5, compassionate: 1 }
      },
      'q3-team-conflict': {
        'call':     { bold: 6 },
        'vote':     { cautious: 4, bold: 2 },
        'research': { curious: 6, cautious: 2 },
        'defer':    { cautious: 5, compassionate: 1 }
      },
      'q4-lost-dog': {
        'chase':    { bold: 7 },
        'call-out': { compassionate: 4, curious: 2 },
        'block':    { cautious: 4, bold: 3 },
        'alert':    { cautious: 5, compassionate: 2 }
      },
      'q5-friend-asks-money': {
        'yes':     { compassionate: 6, bold: 1 },
        'ask':     { curious: 4, compassionate: 3 },
        'plan':    { cautious: 5, compassionate: 3 },
        'soft-no': { cautious: 6 }
      },
      'q6-new-hobby': {
        'sign-up':  { bold: 7 },
        'research': { curious: 6, cautious: 2 },
        'watch':    { cautious: 5, curious: 2 },
        'later':    { cautious: 5 }
      },
      'q7-news-headline': {
        'share': { compassionate: 5, bold: 1 },
        'read':  { curious: 6, cautious: 2 },
        'act':   { bold: 5, compassionate: 4 },
        'wait':  { cautious: 6 }
      },
      'q8-farewell': {
        'party':     { compassionate: 5, bold: 3 },
        'one-on-one':{ compassionate: 6, cautious: 1 },
        'pledge':    { compassionate: 4, cautious: 3 },
        'note':      { compassionate: 6, curious: 2 }
      }
    },
    archetypes: [
      { id: 'bold', label: 'Bold', emoji: '🔥',
        tagline: 'You move first and figure it out as you go.',
        blindSpot: 'Speed can mean someone else pays for a mistake that could\'ve waited.',
        scores: { bold: 95, cautious: 20, curious: 45, compassionate: 50 } },
      { id: 'cautious', label: 'Cautious', emoji: '🛡️',
        tagline: 'You read the room, then move — and rarely regret it.',
        blindSpot: 'Careful can shade into missing the window when the window is the point.',
        scores: { bold: 25, cautious: 95, curious: 45, compassionate: 45 } },
      { id: 'curious', label: 'Curious', emoji: '🔍',
        tagline: "You'd rather understand before you decide.",
        blindSpot: 'Research can become a way to avoid deciding at all.',
        default: true,
        scores: { bold: 30, cautious: 50, curious: 95, compassionate: 45 } },
      { id: 'compassionate', label: 'Compassionate', emoji: '💛',
        tagline: 'You lead with the people in front of you.',
        blindSpot: 'Caring can crowd out the harder, more strategic moves.',
        scores: { bold: 40, cautious: 35, curious: 40, compassionate: 95 } }
    ]
  };

  var TRAIT_LABELS = {
    bold: 'Bold', cautious: 'Cautious', curious: 'Curious', compassionate: 'Compassionate'
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
    var QUIZ_SLUG = 'what-would-you-do';

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
            resetBtn.setAttribute('aria-label', 'Reset what would you do quiz');
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
          try { console.error('what-would-you-do: result render failed:', e); } catch (_) {}
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
