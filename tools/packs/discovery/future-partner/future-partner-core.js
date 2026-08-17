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
      if (reduced) {
        f.style.width = pct + '%';
      } else {
        (function (fill, target) {
          window.requestAnimationFrame(function () {
            fill.style.width = target + '%';
          });
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
        var reveal = renderReveal(answers, scored);
        var body = mount.querySelector('.quiz-reveal .quiz-reveal-body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(reveal);
          var resetBtn = body.querySelector('[data-action="reset"]');
          if (resetBtn) {
            resetBtn.addEventListener('click', function () {
              try { handle.close(); } catch (_) {}
              boot();
            });
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
