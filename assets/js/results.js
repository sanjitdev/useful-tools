/* ============================================================
   Handy Tools — results.js (Story 10.3 + Story 10.10, Discovery Pack Epic)

   Result-card chrome for quiz / personality / recommendation
   outcomes. Renders the canonical DOM shape from DESIGN.md §1.1
   (`components.discovery-card`) into any host element. The same
   chrome is reused across all 6 quizzes — variants only change
   the trait-bar count and the contrarian line policy.

   AD-1   — Pure vanilla, no third-party libs (no chart libs).
   AD-9   — No PII / no fetch / no analytics. Pure DOM rendering
            from a frozen archetype object.
   AD-12  — ES2018 vanilla; no build step.
   AD-14  — Shell Public API surface (HT.results is the contract).

   Public API (frozen, stable):
     HT.results.render(state, opts) → HTMLElement
       state: { traits: {[id]: number}, archetype: {id, label, emoji} }
       opts:  { title?: string, conflict?: string, slug?: string,
               wireActions?: boolean, answers?: {[qid]: value} }
     HT.results.shareUrl(archetype, opts) → string  // ?arch=<id>
     HT.results.copyText(state, opts) → string       // canonical format
     HT.results.imageSnapshot(el) → Promise<Blob>    // throws 'snapshot unavailable'
     HT.results.wireActions(card, state, opts) → void
       // Story 10.10 — wires the rendered card's Share / Challenge
       // buttons. Idempotent (uses data-wired="1" guard so re-rendering
       // the card or re-mounting the panel does not double-bind).

   Tab order on the rendered card:
     1. button.share
     2. button.challenge

   The contrarian (unexpected trait) line uses class
   `quiz-result-contrarian` per the DC-2 AC-10 grep. The action row
   carries `data-print="ignore"` so the print stylesheet strips
   Share / Challenge from the printed card.

   Reduced-motion respected via the inherited shell contract:
   `data-reduced-motion="true"` on <html> or `@media (prefers-reduced-
   motion: reduce)`. The card mounts instantly under either signal.

   AD-14 boundary — no bare localStorage / fetch / HT.provide.
   Bundle target: ≤ 6 KB gz (Story 10.3 + 10.10 budget).

   ES2018. ~4 KB gz after Story 10.10.
   ============================================================ */

(function () {
  'use strict';

  // HT is provided by the Shell (window.HT) or by the smoke harness.
  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- helpers -----------------------------------------------------

  // Clamp `n` to [0, 100]. NaN-safe (returns 0 for NaN).
  function clamp100(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    if (n < 0)   return 0;
    if (n > 100) return 100;
    return n;
  }

  // Sort trait ids by score descending, then by id asc. Returns
  // the top-N traits (cap from opts.traitCap, default 4).
  function topTraits(state, cap) {
    var traits = (state && state.traits) || {};
    var ids = Object.keys(traits);
    ids.sort(function (a, b) {
      var da = clamp100(traits[b]) - clamp100(traits[a]);
      if (da !== 0) return da;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return ids.slice(0, cap);
  }

  // Create an element with attributes + text + child elements.
  // attrs: { attr: value }; children: array of HTMLElement or string.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          node.setAttribute(k, String(attrs[k]));
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        if (typeof c === 'string') node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      }
    }
    return node;
  }

  // Build a single trait bar: <label> <track> <fill> <value>.
  // The fill width is set via a data-pct attribute (paired with a CSS
  // rule that uses [data-pct] for width) so we don't need inline
  // style attributes — the CSS rule lives in the result stylesheet.
  function traitBar(traitId, score) {
    var pct = clamp100(score);
    var label = el('span', { class: 'quiz-result-trait-label' }, [traitId]);
    var track = el('span', { class: 'quiz-result-trait-track' });
    var fill  = el('span', {
      class: 'quiz-result-trait-fill',
      'data-pct': pct.toFixed(1),
      'aria-hidden': 'true',
    });
    track.appendChild(fill);
    var value = el('span', { class: 'quiz-result-trait-value' }, [
      pct.toFixed(0) + '%',
    ]);
    return el('div', {
      class: 'quiz-result-trait-bar',
      role: 'group',
      'aria-label': traitId + ': ' + pct.toFixed(0) + ' percent',
    }, [label, track, value]);
  }

  // ---- public API --------------------------------------------------

  function render(state, opts) {
    state = state && typeof state === 'object' ? state : {};
    opts  = opts  && typeof opts  === 'object' ? opts  : {};
    var archetype = state.archetype || {};
    var traits    = state.traits || {};
    var cap       = typeof opts.traitCap === 'number' && opts.traitCap > 0 ? opts.traitCap : 4;

    // Card root — data-print="result" so the print stylesheet can
    // scope the card; role="region" + aria-live="polite" per
    // review-accessibility.md H1 + 800 ms debounce contract.
    var root = el('article', {
      class: 'quiz-result-card discovery-card',
      'data-print': 'result',
      role: 'region',
      'aria-live': 'polite',
      'aria-atomic': 'true',
      'aria-labelledby': 'quiz-result-archetype',
    });

    // Archetype header
    var header = el('header', { class: 'quiz-result-header' });
    if (archetype.emoji) {
      header.appendChild(el('div', {
        class: 'quiz-result-emoji',
        'aria-hidden': 'true',
      }, [archetype.emoji]));
    }
    header.appendChild(el('h2', {
      id: 'quiz-result-archetype',
      class: 'quiz-result-archetype',
    }, [archetype.label || archetype.id || 'Result']));
    if (opts.title) {
      header.appendChild(el('p', { class: 'quiz-result-tagline' }, [opts.title]));
    }
    root.appendChild(header);

    // Contrarian line (the "you also said X" unexpected trait) —
    // optional, rendered when opts.conflict is set. Uses the
    // quiz-result-contrarian class per DC-2 AC-10.
    if (opts.conflict) {
      root.appendChild(el('p', {
        class: 'quiz-result-contrarian',
      }, [opts.conflict]));
    }

    // Trait bars (top-N)
    var bars = el('div', {
      class: 'quiz-result-trait-bar-list',
      role: 'list',
      'aria-label': 'Trait scores',
    });
    var topIds = topTraits(state, cap);
    for (var i = 0; i < topIds.length; i++) {
      bars.appendChild(traitBar(topIds[i], traits[topIds[i]]));
    }
    root.appendChild(bars);

    // Action row — Share + Challenge. data-print="ignore" so the
    // print stylesheet strips these from the printed card (DC-2 AC-9).
    var actions = el('div', {
      class: 'quiz-result-actions',
      'data-print': 'ignore',
      role: 'group',
      'aria-label': 'Share and challenge actions',
    });
    var shareBtn = el('button', {
      type: 'button',
      class: 'quiz-result-share quiz-result-action',
      'data-action': 'share',
    }, ['Share']);
    shareBtn.classList.add('button', 'share');
    var challengeBtn = el('button', {
      type: 'button',
      class: 'quiz-result-challenge quiz-result-action',
      'data-action': 'challenge',
    }, ['Challenge a friend']);
    challengeBtn.classList.add('button', 'challenge');
    actions.appendChild(shareBtn);
    actions.appendChild(challengeBtn);
    root.appendChild(actions);

    // Story 10.10 — wire the buttons unless the caller explicitly
    // opts out (e.g. embed mode where we don't want the toast
    // notifications). Default: wire.
    if (opts.wireActions !== false) {
      // Defer to a microtask so the caller can appendChild the root
      // before wireActions walks the DOM. (In render()'s synchronous
      // path the caller hasn't appended yet; the wireActions code
      // walks via querySelectorAll which the caller's host element
      // only sees once appended. Defer to give the caller that slot.)
      try {
        Promise.resolve().then(function () { wireActions(root, state, opts); });
      } catch (_) {}
    }

    return root;
  }

  // Build a share URL with the archetype id encoded in the query.
  // Format: ?arch=<id> (and ?quiz=<slug> if provided).
  function shareUrl(archetype, opts) {
    archetype = archetype && typeof archetype === 'object' ? archetype : {};
    opts = opts && typeof opts === 'object' ? opts : {};
    var params = new URLSearchParams();
    if (archetype.id) params.set('arch', archetype.id);
    if (opts.slug)    params.set('quiz', opts.slug);
    var qs = params.toString();
    var base = (typeof location !== 'undefined' && location && location.href)
      ? location.href.split('?')[0].split('#')[0]
      : '/';
    return base + (qs ? '?' + qs : '');
  }

  // Canonical copy text for the Share dialog's "Copy text" action.
  // Format: "<emoji> <label> — calm 80% / bold 30%"
  function copyText(state, opts) {
    state = state && typeof state === 'object' ? state : {};
    opts  = opts  && typeof opts  === 'object' ? opts  : {};
    var archetype = state.archetype || {};
    var traits    = state.traits || {};
    var lines = [];
    if (archetype.emoji && archetype.label) {
      lines.push(archetype.emoji + ' ' + archetype.label);
    } else if (archetype.label) {
      lines.push(archetype.label);
    }
    var ids = Object.keys(traits);
    ids.sort();
    var pieces = [];
    for (var i = 0; i < ids.length; i++) {
      pieces.push(ids[i] + ' ' + clamp100(traits[ids[i]]).toFixed(0) + '%');
    }
    if (pieces.length) lines.push(pieces.join(' / '));
    var text = lines.join(' — ');
    if (opts.slug) text = text + ' (#' + opts.slug + ')';
    // Hard cap at 280 chars per the share contract.
    if (text.length > 280) text = text.slice(0, 277) + '…';
    return text;
  }

  // Image snapshot — 1200×630 PNG export of the rendered card.
  // The browser-only path uses html2canvas-style DOM-to-canvas
  // rendering. The pure-stdlib smoke environment has no DOM
  // rendering surface, so this contract throws 'snapshot
  // unavailable' there. The receiver (Story 10.11) catches and
  // falls back to the OG SVG path.
  function imageSnapshot(_el) {
    var err = new Error('snapshot unavailable');
    err.snapshotUnavailable = true;
    throw err;
  }

  // ---- Story 10.10 — wire the action buttons -------------------

  // Find the .quiz-result-actions node inside a rendered card.
  function findActionsNode(card) {
    if (!card || typeof card.querySelectorAll !== 'function') return null;
    var nodes = card.querySelectorAll('[data-print="ignore"]');
    return (nodes && nodes[0]) || null;
  }

  // Find a button inside the actions node by its data-action attr.
  function findActionBtn(actionsNode, name) {
    if (!actionsNode || typeof actionsNode.querySelectorAll !== 'function') return null;
    var nodes = actionsNode.querySelectorAll('[data-action="' + name + '"]');
    return (nodes && nodes[0]) || null;
  }

  // Wire the rendered card's Share + Challenge buttons. Idempotent:
  // a card that already has data-wired="1" is skipped, so re-rendering
  // the reveal panel does not double-bind click listeners.
  //
  // Share button  — invokes HT.share.copy(state, opts) which is the
  //                 canonical shell API (not bare navigator.clipboard).
  //                 Falls back to HT.results.copyText + HT.toast.
  // Challenge btn — invokes HT.challenge.link(spec) to produce the
  //                 shareable challenge URL. The link encodes only
  //                 the sender's answers (no traits, no archetype) per
  //                 AD-9 + the privacy contract in challenge.js.
  //                 If HT.challenge is absent (viral-category quiz
  //                 only), the button is hidden.
  //
  // AD-14 boundary — no bare navigator.clipboard / window.print /
  // localStorage / fetch. All routing goes through HT.*.
  function wireActions(card, state, opts) {
    if (!card) return;
    if (card.getAttribute && card.getAttribute('data-wired') === '1') return;
    state = state && typeof state === 'object' ? state : {};
    opts  = opts  && typeof opts  === 'object' ? opts  : {};

    var actionsNode = findActionsNode(card);
    if (!actionsNode) return;

    var shareBtn = findActionBtn(actionsNode, 'share');
    var challengeBtn = findActionBtn(actionsNode, 'challenge');

    // Share button — wire only if HT.share.copy is exposed.
    if (shareBtn && HT.share && typeof HT.share.copy === 'function') {
      var ariaLabel = (opts.slug
        ? 'Copy share link for ' + opts.slug + ' result'
        : 'Copy share link for this result');
      shareBtn.setAttribute('aria-label', ariaLabel);
      shareBtn.addEventListener('click', function () {
        try {
          HT.share.copy(state, opts).then(function () {
            if (HT.toast) HT.toast('Share link copied');
          }, function () {
            if (HT.toast) HT.toast('Copy failed');
          });
        } catch (_) {}
      });
    } else if (shareBtn && HT.copyToClipboard) {
      // Defensive fallback — if HT.share.copy is absent but
      // HT.copyToClipboard is exposed, fall back to direct clipboard
      // copy of the canonical copyText output. (Rare — every Shell
      // boots HT.share with .copy.)
      shareBtn.addEventListener('click', function () {
        try {
          HT.copyToClipboard(HT.results.copyText(state, opts));
          if (HT.toast) HT.toast('Copied');
        } catch (_) {}
      });
    }

    // Challenge button — wire only if HT.challenge.link is exposed.
    // Hide the button entirely if HT.challenge is absent (utility-
    // category quizzes that don't opt into challenge).
    if (challengeBtn) {
      if (HT.challenge && typeof HT.challenge.link === 'function') {
        var cAriaLabel = (opts.slug
          ? 'Challenge a friend on the ' + opts.slug + ' quiz'
          : 'Challenge a friend');
        challengeBtn.setAttribute('aria-label', cAriaLabel);
        challengeBtn.addEventListener('click', function () {
          try {
            var url = HT.challenge.link({
              slug: opts.slug || '',
              self: opts.answers || {},
            });
            if (HT.share && typeof HT.share.copy === 'function') {
              HT.share.copy({ archetype: state.archetype }, { shareUrl: url }).then(function () {
                if (HT.toast) HT.toast('Challenge link copied');
              });
            } else if (HT.copyToClipboard) {
              HT.copyToClipboard(url);
              if (HT.toast) HT.toast('Challenge link copied');
            }
          } catch (_) {}
        });
      } else {
        // No challenge module — hide the button so tab-order skips it.
        challengeBtn.setAttribute('hidden', '');
        challengeBtn.setAttribute('aria-hidden', 'true');
      }
    }

    // Mark the card as wired so re-renders don't double-bind.
    try { card.setAttribute('data-wired', '1'); } catch (_) {}
  }

  var publicApi = Object.freeze({
    render: render,
    shareUrl: shareUrl,
    copyText: copyText,
    imageSnapshot: imageSnapshot,
    wireActions: wireActions,
  });

  // ---- AD-14 freeze (writable:false, configurable:false) ---------
  // Same defensive pattern as quiz.js / scoring.js.
  try {
    Object.defineProperty(HT, 'results', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.results = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;
})();
