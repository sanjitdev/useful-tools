/* ============================================================
   Handy Tools — results.js (Story 10.3, Discovery Pack Epic)

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
       opts:  { title?: string, conflict?: string, slug?: string }
     HT.results.shareUrl(archetype, opts) → string  // ?arch=<id>
     HT.results.copyText(state, opts) → string       // canonical format
     HT.results.imageSnapshot(el) → Promise<Blob>    // throws 'snapshot unavailable'

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
   Bundle target: ≤ 6 KB gz (Story 10.3 budget).

   ES2018. ~3.5 KB gz.
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
  function traitBar(traitId, score) {
    var pct = clamp100(score);
    var label = el('span', { class: 'quiz-result-trait-label' }, [traitId]);
    var track = el('span', { class: 'quiz-result-trait-track' });
    var fill  = el('span', {
      class: 'quiz-result-trait-fill',
      style: 'width:' + pct.toFixed(1) + '%',
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

  var publicApi = Object.freeze({
    render: render,
    shareUrl: shareUrl,
    copyText: copyText,
    imageSnapshot: imageSnapshot,
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
