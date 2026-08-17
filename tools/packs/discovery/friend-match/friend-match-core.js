/* ============================================
   friend-match-core.js — Story 10.7
   Discovery Quiz: Friend Match
   ============================================ */
'use strict';

(function () {
  var QUESTIONS = [
    { id: 'q1-weekend-text', label: 'Random weekend text',
      prompt: 'A friend randomly texts you on a Saturday. You...',
      options: [
        { value: 'drop-everything', label: 'Drop everything and meet them in an hour' },
        { value: 'long-call',       label: 'Hop on a long voice call to catch up properly' },
        { value: 'schedule',        label: 'Suggest a specific day next week to hang out' },
        { value: 'kind-reply',      label: 'Reply warmly, share a thought, promise to follow up' }
      ] },
    { id: 'q2-friend-bad-news', label: 'Bad news',
      prompt: "A friend tells you they're going through a hard time.",
      options: [
        { value: 'show-up',    label: "Show up at their door within the hour" },
        { value: 'call',       label: 'Call them right away and just listen' },
        { value: 'small',      label: 'Send a small care package and a note' },
        { value: 'check-ins',  label: 'Set up a recurring check-in over the next weeks' }
      ] },
    { id: 'q3-friend-group', label: 'Group hangout',
      prompt: 'When the group hangs out, what\'s your role?',
      options: [
        { value: 'host',   label: 'The one who organized it and keeps it moving' },
        { value: 'anchor', label: 'The quiet one in the corner everyone checks in with' },
        { value: 'story',  label: 'The one with the story that turns into a second hangout' },
        { value: 'wing',   label: 'The one making sure everyone has a ride home' }
      ] },
    { id: 'q4-gift', label: 'Birthday gift',
      prompt: 'Pick your friendship gift style.',
      options: [
        { value: 'spot-on',    label: 'Something specific they mentioned once, three months ago' },
        { value: 'experience', label: 'An experience you can do together' },
        { value: 'handmade',   label: 'Something handmade or personal' },
        { value: 'funny',      label: 'Something funny that only they would get' }
      ] },
    { id: 'q5-distance', label: 'Friend moves away',
      prompt: 'A close friend moves to another city. You...',
      options: [
        { value: 'weekly',  label: 'Schedule weekly video calls and stick to them' },
        { value: 'visit',   label: 'Plan to visit them within the next few months' },
        { value: 'letters', label: 'Commit to handwritten letters' },
        { value: 'natural', label: 'Let the rhythm find itself; reach out when it feels right' }
      ] },
    { id: 'q6-big-news', label: 'Big personal news',
      prompt: 'Your friend just got engaged. Your first instinct?',
      options: [
        { value: 'cry-happy',  label: 'Cry happy tears in person as fast as possible' },
        { value: 'plan-party', label: "Start planning how you'll celebrate" },
        { value: 'long-talk',  label: 'Pull them aside for a long talk about how they feel' },
        { value: 'love-note',  label: 'Send a long, heartfelt message they can re-read' }
      ] },
    { id: 'q7-disagreement', label: 'Friend disagreement',
      prompt: 'You and a close friend disagree about something they care about.',
      options: [
        { value: 'say-it',    label: 'Say it clearly; honesty is the bedrock' },
        { value: 'let-it-go', label: 'Pick your battles; let it go this time' },
        { value: 'ask',       label: 'Ask good questions until they hear themselves' },
        { value: 'defer',     label: 'Yield; this matters more to them than to you' }
      ] },
    { id: 'q8-energy', label: 'Friendship energy',
      prompt: 'Honest check-in: how are you at showing up for friends lately?',
      options: [
        { value: 'very',     label: 'Very on — I reach out before they do' },
        { value: 'balanced', label: 'Balanced — give and take, mostly even' },
        { value: 'tired',    label: 'Tired — I want to, but my tank is low' },
        { value: 'thinking', label: 'Thinking about who I want to be closer to' }
      ] },
    { id: 'q9-secret', label: "A friend's secret",
      prompt: "A friend tells you something they've never told anyone else.",
      options: [
        { value: 'vault',  label: 'Vault it forever, never speak of it again' },
        { value: 'check',  label: 'Hold it, then quietly check on them about it later' },
        { value: 'honor',  label: 'Honor it by living like you know — without saying' },
        { value: 'thank',  label: 'Thank them for trusting you with it' }
      ] }
  ];

  var SCORING_SPEC = {
    traits: ['warmth', 'loyalty', 'energy', 'depth'],
    weights: {
      'q1-weekend-text': {
        'drop-everything': { energy: 6, warmth: 2 },
        'long-call':       { depth: 6, warmth: 2 },
        'schedule':        { loyalty: 5, warmth: 1 },
        'kind-reply':      { warmth: 6, depth: 2 }
      },
      'q2-friend-bad-news': {
        'show-up':   { energy: 6, warmth: 2 },
        'call':      { depth: 6, warmth: 2 },
        'small':     { warmth: 5, depth: 2 },
        'check-ins': { loyalty: 6, depth: 2 }
      },
      'q3-friend-group': {
        'host':   { energy: 6, warmth: 1 },
        'anchor': { loyalty: 6, warmth: 2 },
        'story':  { depth: 5, energy: 2 },
        'wing':   { loyalty: 5, warmth: 3 }
      },
      'q4-gift': {
        'spot-on':    { depth: 6, loyalty: 2 },
        'experience': { energy: 5, warmth: 3 },
        'handmade':   { depth: 6, warmth: 3 },
        'funny':      { energy: 4, warmth: 4 }
      },
      'q5-distance': {
        'weekly':  { loyalty: 7 },
        'visit':   { energy: 5, warmth: 2 },
        'letters': { depth: 6, loyalty: 2 },
        'natural': { depth: 3, warmth: 3 }
      },
      'q6-big-news': {
        'cry-happy':  { warmth: 7 },
        'plan-party': { energy: 6, warmth: 2 },
        'long-talk':  { depth: 6, loyalty: 2 },
        'love-note':  { depth: 6, warmth: 2 }
      },
      'q7-disagreement': {
        'say-it':    { depth: 6, loyalty: 1 },
        'let-it-go': { warmth: 4, loyalty: 2 },
        'ask':       { depth: 6, warmth: 2 },
        'defer':     { loyalty: 6, warmth: 2 }
      },
      'q8-energy': {
        'very':     { energy: 7 },
        'balanced': { loyalty: 4, warmth: 3 },
        'tired':    { depth: 4, loyalty: 1 },
        'thinking': { depth: 5, loyalty: 1 }
      },
      'q9-secret': {
        'vault': { loyalty: 7 },
        'check': { loyalty: 4, depth: 3 },
        'honor': { depth: 6, loyalty: 2 },
        'thank': { warmth: 5, depth: 2 }
      }
    },
    archetypes: [
      { id: 'ride-or-die', label: 'The Ride-or-Die', emoji: '🛡️',
        tagline: 'Loyal, present, and the first one at the door when it matters.',
        blindSpot: 'Loyalty can crowd out the friend you haven\'t met yet.',
        scores: { warmth: 60, loyalty: 95, energy: 50, depth: 45 } },
      { id: 'confidant', label: 'The Confidant', emoji: '🔐',
        tagline: 'Deep, careful, and trusted with the things no one else hears.',
        blindSpot: 'Holding space for everyone can quietly empty your own.',
        default: true,
        scores: { warmth: 50, loyalty: 70, energy: 30, depth: 95 } },
      { id: 'spark', label: 'The Spark', emoji: '✨',
        tagline: 'High energy, big plans, and the reason the group showed up tonight.',
        blindSpot: 'Energy can outpace follow-through when the moment passes.',
        scores: { warmth: 55, loyalty: 45, energy: 95, depth: 35 } },
      { id: 'warm-presence', label: 'The Warm Presence', emoji: '🌿',
        tagline: 'Steady warmth, easy to be around, the room feels safer with you in it.',
        blindSpot: 'Quiet can be mistaken for passive when actually showing up is what you do.',
        scores: { warmth: 95, loyalty: 60, energy: 40, depth: 55 } },
      { id: 'memory-keeper', label: 'The Memory Keeper', emoji: '📔',
        tagline: 'You remember the small things and surface them at exactly the right time.',
        blindSpot: 'Memory can become a way of holding on tighter than is healthy.',
        scores: { warmth: 70, loyalty: 75, energy: 35, depth: 75 } },
      { id: 'playmaker', label: 'The Playmaker', emoji: '🎈',
        tagline: 'You turn ordinary Tuesdays into stories people retell.',
        blindSpot: 'The spotlight can crowd out the quieter friend who needs you most.',
        scores: { warmth: 65, loyalty: 50, energy: 80, depth: 50 } }
    ]
  };

  var TRAIT_LABELS = {
    warmth: 'Warmth', loyalty: 'Loyalty', energy: 'Energy', depth: 'Depth'
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

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', boot); } else { boot(); }
})();
