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

  function renderReveal(answers, scored) {
    var arch = (scored && scored.archetype) ? scored.archetype : null;
    var traits = (scored && scored.traits) ? scored.traits : {};
    var wrap = el('div', { class: 'disc-reveal', 'data-print': 'result' });

    var hero = el('div', { class: 'disc-reveal-hero' });
    hero.appendChild(el('div', { class: 'disc-reveal-emoji', text: arch ? arch.emoji : '✨' }));
    hero.appendChild(el('h2', { class: 'disc-reveal-label', text: arch ? arch.label : 'Result' }));
    if (arch && arch.tagline) {
      hero.appendChild(el('p', { class: 'disc-reveal-tagline', text: arch.tagline }));
    }
    wrap.appendChild(hero);

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

    if (arch && arch.blindSpot) {
      var bl = el('aside', { class: 'disc-blind-spot' });
      bl.appendChild(el('h3', { class: 'disc-blind-spot-title', text: 'Blind spot' }));
      bl.appendChild(el('p', { class: 'disc-blind-spot-body', text: arch.blindSpot }));
      wrap.appendChild(bl);
    }

    var actions = el('div', { class: 'disc-actions', 'data-print': 'ignore' });
    var resetBtn = el('button', {
      type: 'button', class: 'btn btn-primary', 'data-action': 'reset',
      text: 'Take it again'
    });
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

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
      if (reduced) { f.style.width = pct + '%'; }
      else {
        (function (fill, target) {
          window.requestAnimationFrame(function () { fill.style.width = target + '%'; });
        })(f, pct);
      }
    }
  }

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
      onChange: function () {},
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
        var body = mount.querySelector('.quiz-reveal .quiz-reveal-body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(reveal);
          var resetBtn = body.querySelector('[data-action="reset"]');
          if (resetBtn) {
            resetBtn.setAttribute('aria-label', 'Reset What Would You Do quiz');
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
