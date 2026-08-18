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

  function renderReveal(answers, scored) {
    var arch = (scored && scored.archetype) ? scored.archetype : null;
    var traits = (scored && scored.traits) ? scored.traits : {};
    var wrap = el('div', { class: 'disc-reveal', 'data-print': 'result' });
    var hero = el('div', { class: 'disc-reveal-hero' });
    hero.appendChild(el('div', { class: 'disc-reveal-emoji', text: arch ? arch.emoji : '✨' }));
    hero.appendChild(el('h2', { class: 'disc-reveal-label', text: arch ? arch.label : 'Result' }));
    if (arch && arch.tagline) hero.appendChild(el('p', { class: 'disc-reveal-tagline', text: arch.tagline }));
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
    var resetBtn = el('button', { type: 'button', class: 'btn btn-primary', 'data-action': 'reset', text: 'Take it again' });
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  function animateBars(host) {
    if (!host) return;
    var reduced = false;
    try { reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    var fills = host.querySelectorAll('.disc-trait-bar-fill');
    for (var i = 0; i < fills.length; i += 1) {
      var f = fills[i];
      var pct = parseFloat(f.getAttribute('data-pct') || '0');
      if (reduced) { f.style.width = pct + '%'; }
      else { (function (fill, target) { window.requestAnimationFrame(function () { fill.style.width = target + '%'; }); })(f, pct); }
    }
  }

  function boot() {
    var mount = document.getElementById('quiz-mount');
    if (!mount) return;
    if (!window.HT || !window.HT.quiz || typeof window.HT.quiz.open !== 'function') { mount.textContent = 'HT.quiz failed to load.'; return; }
    if (!window.HT.scoring || typeof window.HT.scoring.score !== 'function') { mount.textContent = 'HT.scoring failed to load.'; return; }
    var handle = window.HT.quiz.open({
      mount: mount, questions: QUESTIONS,
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
            resetBtn.setAttribute('aria-label', 'Reset Decision Style quiz');
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

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
