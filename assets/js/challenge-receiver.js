/* challenge-receiver.js (Story 10.12)
   Receiver-side landing hook for challenge URLs.
   Privacy default: blind (a11y B2). AD-14 frozen. ES2018. */
(function () {
  'use strict';

  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self !== 'undefined' && !self.HT) self.HT = HT;

  var STORAGE_PREFIX = 'ht.challenge.local.';

  // URL parsing — accept ?c= or <blob> in fragment as fallback.
  function getChallengeBlob() {
    try {
      var qs = new URLSearchParams(window.location.search).get('c');
      if (qs) return qs;
      var h = (window.location.hash || '').replace(/^#/, '');
      var m = h.match(/(?:^|&)c=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch (_) {}
    return null;
  }

  // Verify + decode the blob.
  function decodeBlob(blob) {
    if (!HT.challenge || typeof HT.challenge.verify !== 'function') {
      return { ok: false, code: 'malformed', message: 'challenge module unavailable' };
    }
    var verify = HT.challenge.verify(blob);
    if (!verify || !verify.ok) {
      return { ok: false, code: verify ? verify.code : 'malformed',
               message: verify && verify.message ? verify.message : 'invalid blob' };
    }
    var payload;
    try {
      payload = JSON.parse(atob(blob.replace(/-/g, '+').replace(/_/g, '/')));
    } catch (e) {
      return { ok: false, code: 'malformed', message: 'blob could not be decoded' };
    }
    return { ok: true, payload: payload, verify: verify };
  }

  // Privacy banner — render above the quiz mount.
  function renderBanner(host, opts) {
    if (!host) return null;
    var state = { reveal: opts.reveal === true };
    var root = document.createElement('section');
    root.className = 'challenge-banner';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-labelledby', 'challenge-banner-title');

    var title = document.createElement('h2');
    title.id = 'challenge-banner-title';
    title.className = 'challenge-banner-title';
    title.textContent = 'Challenge from ' + (opts.friendLabel || 'a friend');
    root.appendChild(title);

    var body = document.createElement('p');
    body.className = 'challenge-banner-body';
    body.textContent = state.reveal
      ? 'Showing you their result. Your answers stay on this device.'
      : 'Take the quiz blind to get an honest compatibility read.';
    root.appendChild(body);

    var toggle = document.createElement('label');
    toggle.className = 'challenge-banner-toggle';
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.reveal;
    cb.setAttribute('aria-describedby', 'challenge-banner-toggle-help');
    cb.addEventListener('change', function () {
      state.reveal = cb.checked;
      body.textContent = state.reveal
        ? 'Showing you their result. Your answers stay on this device.'
        : 'Take the quiz blind to get an honest compatibility read.';
      if (opts.onToggle) opts.onToggle(state.reveal);
    });
    toggle.appendChild(cb);
    toggle.appendChild(document.createTextNode(' Show me what they got first'));
    root.appendChild(toggle);

    var help = document.createElement('p');
    help.id = 'challenge-banner-toggle-help';
    help.className = 'challenge-banner-help';
    help.textContent = 'Default is blind — your friend cannot see your answers until you submit.';
    root.appendChild(help);

    host.insertBefore(root, host.firstChild);
    return root;
  }

  // aria-live announcement (a11y B2).
  function announce(text) {
    try {
      var live = document.createElement('div');
      live.setAttribute('role', 'status');
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.className = 'challenge-announce-visually-hidden';
      live.textContent = text;
      document.body.appendChild(live);
      // Remove after the SR has had a chance to read it.
      setTimeout(function () {
        try { live.parentNode && live.parentNode.removeChild(live); } catch (_) {}
      }, 4000);
    } catch (_) {}
  }

  // Landing — public API entry. Called by quiz -core.js when ?c= is detected.
  function landing(quizSlug, host, opts) {
    opts = opts || {};
    var blob = opts.blob || getChallengeBlob();
    if (!blob) return { ok: false, code: 'no-blob' };
    var decoded = decodeBlob(blob);
    if (!decoded.ok) {
      // Render an inline error in place of the quiz mount.
      if (host) {
        host.innerHTML = '';
        var err = document.createElement('section');
        err.className = 'challenge-error';
        err.setAttribute('role', 'alert');
        var eh = document.createElement('h2');
        eh.textContent = 'Challenge unavailable';
        err.appendChild(eh);
        var ep = document.createElement('p');
        ep.textContent = decoded.message || 'This challenge link could not be opened.';
        err.appendChild(ep);
        host.appendChild(err);
      }
      announce('Challenge link unavailable.');
      return decoded;
    }
    var friendArchetype = decoded.payload && decoded.payload.slug ? decoded.payload.slug : null;
    var banner = renderBanner(host, {
      friendLabel: friendArchetype ? 'a ' + friendArchetype : 'a friend',
      reveal: opts.reveal === true,
      onToggle: opts.onToggle,
    });
    announce('Challenge from a friend loaded. Default: take the quiz blind.');
    return {
      ok: true,
      blob: blob,
      payload: decoded.payload,
      banner: banner,
      slug: quizSlug,
    };
  }

  // Compare view — side-by-side card for /<slug>/compare.html.
  function compareView(quizSlug, selfA, selfB, host) {
    if (!HT.challenge || typeof HT.challenge.compare !== 'function') {
      host.textContent = 'challenge module unavailable';
      return;
    }
    var result = HT.challenge.compare(selfA, selfB);
    var card = document.createElement('section');
    card.className = 'compatibility-card';
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Compatibility result');

    var head = document.createElement('h2');
    head.textContent = 'Compatibility';
    card.appendChild(head);

    var pct = document.createElement('p');
    pct.className = 'compatibility-card-score';
    pct.textContent = result.score + '%';
    card.appendChild(pct);

    var band = document.createElement('div');
    band.className = 'compatibility-card-band';
    if (result.score >= 80) band.classList.add('band-high');
    else if (result.score >= 50) band.classList.add('band-mid');
    else band.classList.add('band-low');
    card.appendChild(band);

    var detail = document.createElement('p');
    detail.className = 'compatibility-card-detail';
    detail.textContent = (result.axes || []).length + ' questions compared';
    card.appendChild(detail);

    host.appendChild(card);
  }

  // Local persistence — quiz core stashes answers on completion.
  function stashLocalAnswers(quizSlug, answers) {
    try {
      var key = STORAGE_PREFIX + quizSlug;
      window.localStorage.setItem(key, JSON.stringify(answers));
    } catch (_) {}
  }

  function readLocalAnswers(quizSlug) {
    try {
      var raw = window.localStorage.getItem(STORAGE_PREFIX + quizSlug);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  // AD-14 freeze.
  var publicApi = Object.freeze({
    landing: landing,
    compareView: compareView,
    getChallengeBlob: getChallengeBlob,
    stashLocalAnswers: stashLocalAnswers,
    readLocalAnswers: readLocalAnswers,
  });

  try {
    Object.defineProperty(HT, 'challengeReceiver', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.challengeReceiver = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self !== 'undefined') self.HT = HT;
})();