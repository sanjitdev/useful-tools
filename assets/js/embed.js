/* ============================================
   Instance-scoped embed API for third-party
   iframe hosts. One HT.embed factory call per
   embed produces an independent frozen object;
   multiple embeds on one host page do not share
   state because each carries its own UUID and
   message bus. The full postMessage envelope
   lands in the next story; this module ships the
   bare surface (UUID + slug + postMessage seam
   + listener registration + destroy) so the
   Shell router can publish a working instance
   on day one.

   ES2018. No dependencies on third-party
   libraries. Read-only by convention; Object.freeze
   on every published surface per the Shell
   Public API Contract.
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  window.HT = window.HT || {};
  const HT = window.HT;
  if (HT.embed) return; // idempotent across re-entries

  // Lazy-load embed-modal.css on first call to openModal. The
  // stylesheet is unconditional (no [data-embed] gate — the
  // modal is rendered on every page that has the Embed button,
  // including the home page and tool pages in non-embed mode).
  // embed.js is already loaded on every page via shell-template.py,
  // so adding the <link> here means the modal opens with full
  // styling even on the first invocation. The marker attribute
  // 'data-embed-modal-stylesheet="1"' lets the smoke harness
  // verify the link was injected.
  let _cssLoaded = false;
  function _ensureCssLoaded() {
    if (_cssLoaded) return;
    if (typeof document === 'undefined') return;
    try {
      // Compute the relative path from the embed.js script's own
      // URL. embed.js always lives at <repo-root>/assets/js/embed.js
      // regardless of which page loaded it. Use document.currentScript
      // first, fall back to the existing FOUC <link> tag's href if
      // currentScript is null (defer-attribute scenarios).
      let cssUrl = '../../assets/css/embed-modal.css';
      try {
        if (document.currentScript && document.currentScript.src) {
          cssUrl = new URL('../css/embed-modal.css', document.currentScript.src).href;
        } else {
          // Fallback: find an existing embed.js <link>/<script>
          // element and walk up. embed.js <script> is spliced by
          // shell-template.py with src="assets/js/embed.js" on the
          // home page and src="../../assets/js/embed.js" on tool
          // pages — both resolve to the same absolute URL when
          // rendered.
          const ownScript = document.querySelector('script[src*="/assets/js/embed.js"]');
          if (ownScript && ownScript.src) {
            cssUrl = new URL('../css/embed-modal.css', ownScript.src).href;
          }
        }
      } catch (_) { /* fall back to the relative default */ }
      // Idempotency: skip if already injected.
      if (!document.querySelector('link[data-embed-modal-stylesheet="1"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.setAttribute('data-embed-modal-stylesheet', '1');
        if (document.head) document.head.appendChild(link);
      }
      _cssLoaded = true;
    } catch (_) { /* no-op */ }
  }

  // Whether the runtime host (the embed's parent) is on a
  // developer-friendly origin. Suppresses console.warn noise
  // for non-developer visitors — the embed never knows what
  // its host's hostname is, but its own location is enough
  // for the dev-mode signal (a developer running the embed
  // locally will see the warns; production visitors won't).
  function _isDev() {
    try {
      var h = window.location && window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1';
    } catch (_) {
      return false;
    }
  }

  // Forward an envelope to the host page via postMessage. The
  // envelope shape (validation + origin allowlist + payload
  // size cap) lands in the next story; this seam accepts any
  // object so callers can prototype envelopes immediately.
  function _post(envelope) {
    try {
      if (!envelope || typeof envelope !== 'object') return;
      // '*' is intentional: the embed cannot know the host's
      // exact origin without prior configuration. The host is
      // responsible for filtering by event.source (verified
      // against its own iframe registry).
      window.parent.postMessage(envelope, '*');
      if (_isDev()) {
        try {
          console.warn('[embed] postMessage forwarding — envelope validation lives in the next story seam');
        } catch (_) { /* */ }
      }
    } catch (_) {
      // parent unavailable (file://, sandboxed parent, ...)
    }
  }

  // Register a listener for a specific envelope type. The
  // envelope filter is permissive (any object with the
  // matching type field) — Story 4.3 will tighten this with
  // the full allowlist + payload validation.
  function _on(type, fn) {
    if (typeof type !== 'string' || typeof fn !== 'function') return function () {};
    var handler = function (ev) {
      try {
        var env = (ev && typeof ev.data === 'object' && ev.data) || null;
        if (!env) return;
        if (env.type === type) fn(env, ev);
      } catch (_) {
        // Malformed envelope — silently drop. Story 4.3 will
        // surface a structured warning via console.warn.
      }
    };
    window.addEventListener('message', handler);
    return function off() {
      try { window.removeEventListener('message', handler); } catch (_) { /* */ }
    };
  }

  // Tear down this embed's resources. The ResizeObserver is owned by
  // shell.js's embed boot path; here we only null the global instance
  // reference so a BFCache round-trip starts clean. We deliberately do
  // NOT clear window.name — shell.js owns the window.name write so that
  // BFCache re-entry re-establishes the same identity across restore;
  // clearing it here would race with the FOUC IIFE's re-init on a
  // BFCache restore and orphan the iframe identity on the host.
  function _destroy(instance) {
    try {
      if (window.__HT_RESIZE_OBSERVER__) {
        try { window.__HT_RESIZE_OBSERVER__.disconnect(); } catch (_) { /* */ }
        window.__HT_RESIZE_OBSERVER__ = null;
      }
    } catch (_) { /* */ }
    return instance;
  }

  // Publish a fresh instance-scoped embed object. Each call
  // returns a NEW frozen object so two embeds on the same
  // host page do not share state.
  function _publish(opts) {
    if (!opts || typeof opts.instanceUuid !== 'string' || opts.instanceUuid.length === 0) {
      try {
        console.warn('HT.embed.publish: instanceUuid required');
      } catch (_) { /* */ }
      return null;
    }
    return Object.freeze({
      instanceUuid: opts.instanceUuid,
      slug: typeof opts.slug === 'string' ? opts.slug : null,
      postMessage: _post,
      on: _on,
      destroy: function () { _destroy(this); },
    });
  }

  // -------------------------------------------------------------
  // Snippet modal surface (Story 4.2).
  //
  // HT.embed.openModal(slug, sourceEl?, opts?) — opens the embed
  // snippet modal for the given slug. The modal renders:
  //   1. A <code class="embed-snippet"> element with the exact
  //      iframe HTML per the Story 4.2 spec (URL has ?embed=<slug>,
  //      style="border:0", aria-label, loading="lazy").
  //   2. A <button data-action="copy-snippet">Copy</button> that
  //      copies the snippet text via HT.copyToClipboard and
  //      shows the toast "Copied" for 2 seconds.
  //   3. A live preview <iframe> with sandbox="allow-scripts
  //      allow-same-origin" (NO allow-top-navigation, NO allow-
  //      popups) so the user sees the embed render.
  //   4. A close button + Esc/backdrop dismissal (free via native
  //      <dialog> showModal()).
  //
  // sourceEl is re-focused on close (mirrors HT.share.open's
  // sourceEl pattern). opts.previewWidth / opts.previewHeight
  // override the default 320x240 preview sizing (B3 a11y floor);
  // opts.previewScale (number, default 1.0) lets a future
  // embed-demo page scale the preview into a fixed-size container.
  // -------------------------------------------------------------

  function _escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // URL composition — the spec mandates ?embed=<slug> so the
  // hosted page boots in embed mode (chrome-stripped via Story
  // 4.1). This is different from HT.share.embedCode(slug) which
  // produces a bare /tools/<slug>/ URL (the Share dialog textarea
  // path keeps that legacy form for non-iframe embeds — Markdown,
  // email, etc.).
  function _resolveBase() {
    if (typeof location === 'undefined') return { origin: '', pathBase: '/' };
    const origin = location.origin || '';
    const pathBase = (location.pathname || '/').replace(/\/[^/]*$/, '/');
    return { origin: origin, pathBase: pathBase };
  }

  function _lookupEntry(slug) {
    // Mirror share.js _findEntry — read tools.json inline splice
    // or HT.homeGrid.entries. Used to resolve embed-snippet block
    // dimensions and the tool title.
    try {
      const HT_inner = (typeof window !== 'undefined' && window.HT) || {};
      if (HT_inner.homeGrid && Array.isArray(HT_inner.homeGrid.entries)) {
        for (let i = 0; i < HT_inner.homeGrid.entries.length; i += 1) {
          const e = HT_inner.homeGrid.entries[i];
          if (e && e.slug === slug) return e;
        }
      }
      if (typeof document !== 'undefined') {
        const inline = document.getElementById('ht-tools-json-inline');
        if (inline) {
          try {
            const parsed = JSON.parse(inline.textContent || '');
            if (parsed && Array.isArray(parsed.tools)) {
              for (let i = 0; i < parsed.tools.length; i += 1) {
                const e = parsed.tools[i];
                if (e && e.slug === slug) return e;
              }
            }
          } catch (_) { /* fall through */ }
        }
      }
    } catch (_) { /* defensive */ }
    return null;
  }

  function _resolveSnippetSchema(slug) {
    // Per Story 4.2 spec: <embed.width> defaults to 640 and
    // <embed.height> defaults to 480 when tools.json omits them.
    // The tools.schema.json floor is 240 (B3 a11y minimum) but the
    // spec defaults are 640/480 — the modal uses the spec defaults
    // when tools.json doesn't supply values, and clamps to ≥ 240
    // when it does (the schema's minimum, never below).
    const entry = _lookupEntry(slug);
    const es = entry && entry['embed-snippet'];
    const minW = (es && typeof es['min-width'] === 'number') ? es['min-width'] : 640;
    const minH = (es && typeof es['min-height'] === 'number') ? es['min-height'] : 480;
    const title = (entry && typeof entry.title === 'string') ? entry.title : slug;
    return Object.freeze({
      width: Math.max(240, minW),
      height: Math.max(240, minH),
      title: title,
      hasEmbed: !!es,
    });
  }

  function _renderSnippet(slug, schema) {
    // Spec-mandated attribute order:
    //   src, width, height, loading, title, aria-label, style
    const base = _resolveBase();
    const src = base.origin + base.pathBase + 'tools/' + encodeURIComponent(slug) +
                '/?embed=' + encodeURIComponent(slug);
    const w = Math.max(240, schema.width);
    const h = Math.max(240, schema.height);
    const titleAttr = _escapeHtml(schema.title || slug);
    const ariaLabel = _escapeHtml((schema.title || slug) + ' \u2014 Handy Tools');
    return '<iframe src="' + _escapeHtml(src) + '" width="' + w + '" height="' + h +
      '" loading="lazy" title="' + titleAttr + '" aria-label="' + ariaLabel +
      '" style="border:0"></iframe>';
  }

  function _renderPreviewSrc(slug) {
    // Live preview iframe src — same as the snippet src (the
    // sandbox attribute is set on the iframe element, not in the
    // URL). ?embed=<slug> fires Story 4.1's router inside the
    // preview iframe so the tool boots in embed mode (chrome-
    // stripped, instance UUID generated, history suppressed).
    return _renderSnippet(slug, _resolveSnippetSchema(slug)).match(/src="([^"]+)"/)[1];
  }

  // Single-instance dialog state — mirrors share.js:_state. Rebuilt
  // only when the slug changes; reused across open/close calls so
  // the second open is instant.
  const _modalState = {
    dlg: null,
    slug: null,
    sourceEl: null,
    snippetEl: null,
    copyBtn: null,
    previewEl: null,
    previewLabelEl: null,
    closeBtn: null,
  };

  function _buildModal(slug) {
    const schema = _resolveSnippetSchema(slug);
    const snippetHtml = _renderSnippet(slug, schema);
    const previewSrc = schema.hasEmbed ? _renderPreviewSrc(slug) : '';

    const dlg = document.createElement('dialog');
    dlg.className = 'embed-modal';
    dlg.setAttribute('data-slug', slug);
    dlg.setAttribute('aria-labelledby', 'embed-modal-title');
    dlg.setAttribute('aria-describedby', 'embed-modal-desc');

    dlg.innerHTML =
      '<form method="dialog" class="embed-modal__form">' +
        '<header class="embed-modal__header">' +
          '<h2 id="embed-modal-title" class="embed-modal__title">Embed ' + _escapeHtml(schema.title || slug) + '</h2>' +
          '<button type="button" class="embed-modal__close" data-action="embed-modal-close" aria-label="Close (Esc)">\u00d7</button>' +
        '</header>' +
        '<p id="embed-modal-desc" class="embed-modal__desc">Copy this snippet into your site, or preview the embed below.</p>' +
        '<section class="embed-modal__snippet-section" aria-label="Embed snippet">' +
          '<code class="embed-snippet" tabindex="0">' + _escapeHtml(snippetHtml) + '</code>' +
        '</section>' +
        '<div class="embed-modal__actions">' +
          '<button type="button" data-action="copy-snippet">Copy</button>' +
        '</div>' +
        (schema.hasEmbed
          ? ('<section class="embed-modal__preview-section" aria-label="Live preview">' +
             '<span class="embed-modal__preview-label" aria-hidden="true">Live preview</span>' +
             '<div class="embed-modal__preview">' +
               '<iframe class="embed-modal__preview-frame" title="' + _escapeHtml(schema.title || slug) + ' \u2014 live preview" sandbox="allow-scripts allow-same-origin" src="' + _escapeHtml(previewSrc) + '" width="320" height="240" loading="lazy" style="border:0"></iframe>' +
             '</div>' +
             '</section>')
          : '') +
      '</form>';

    const snippetEl = dlg.querySelector('code.embed-snippet');
    const copyBtn = dlg.querySelector('[data-action="copy-snippet"]');
    const previewEl = dlg.querySelector('.embed-modal__preview-frame');
    const previewLabelEl = dlg.querySelector('.embed-modal__preview-label');
    const closeBtn = dlg.querySelector('[data-action="embed-modal-close"]');

    return {
      dlg: dlg,
      snippetEl: snippetEl,
      copyBtn: copyBtn,
      previewEl: previewEl,
      previewLabelEl: previewLabelEl,
      closeBtn: closeBtn,
      schema: schema,
      snippetHtml: snippetHtml,
    };
  }

  function _ensureModal(slug, sourceEl) {
    if (_modalState.dlg && _modalState.slug === slug) return _modalState;
    if (_modalState.dlg) {
      try { _modalState.dlg.parentNode.removeChild(_modalState.dlg); } catch (_) { /* */ }
      _modalState.dlg = null;
    }
    _ensureCssLoaded();
    const built = _buildModal(slug);
    const host = (typeof document !== 'undefined' && document.body)
      ? document.body
      : null;
    if (host) host.appendChild(built.dlg);
    _modalState.dlg = built;
    _modalState.slug = slug;
    _modalState.sourceEl = sourceEl || null;
    _modalState.snippetEl = built.snippetEl;
    _modalState.copyBtn = built.copyBtn;
    _modalState.previewEl = built.previewEl;
    _modalState.previewLabelEl = built.previewLabelEl;
    _modalState.closeBtn = built.closeBtn;

    // Wire handlers (one-shot per build; the dialog is rebuilt when
    // the slug changes).
    if (built.copyBtn) {
      built.copyBtn.addEventListener('click', function () {
        _copySnippet(_modalState.snippetEl);
      });
    }
    if (built.closeBtn) {
      built.closeBtn.addEventListener('click', function () {
        _closeModal();
      });
    }
    // Backdrop click — close when click target is the dialog itself
    // (the backdrop click bubbles up to the dialog element, but
    // clicks on form contents stop propagation by virtue of being
    // inside the form). Native <dialog>::backdrop is the visual
    // layer; the click target reports as the dialog element.
    if (built.dlg) {
      built.dlg.addEventListener('click', function (ev) {
        try {
          if (ev && ev.target === built.dlg) _closeModal();
        } catch (_) { /* */ }
      });
    }
    // Select-all on snippet focus (matches share.js URL-input pattern).
    if (built.snippetEl) {
      built.snippetEl.addEventListener('focus', function () {
        try {
          const range = document.createRange();
          range.selectNodeContents(built.snippetEl);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (_) { /* */ }
      });
    }
    return _modalState;
  }

  function _copySnippet(snippetEl) {
    if (!snippetEl) return;
    const text = snippetEl.textContent || '';
    try {
      if (typeof HT !== 'undefined' && HT.copyToClipboard) {
        HT.copyToClipboard(text);
      } else if (typeof navigator !== 'undefined' &&
                 navigator.clipboard &&
                 typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text);
      }
      // Spec-mandated toast: "Copied" for 2 seconds (literal — not
      // "Embed code copied" which is the Share dialog textarea path).
      if (typeof HT !== 'undefined' && HT.toast) {
        HT.toast('Copied', 2000);
      }
    } catch (_) { /* clipboard failure already toasted by HT.copyToClipboard */ }
  }

  function _closeModal() {
    if (!_modalState.dlg) return;
    const dlg = _modalState.dlg.dlg;
    try {
      if (typeof dlg.close === 'function' && dlg.open) dlg.close();
      else dlg.removeAttribute('open');
    } catch (_) { /* */ }
    if (_modalState.sourceEl && typeof _modalState.sourceEl.focus === 'function') {
      try { _modalState.sourceEl.focus(); } catch (_) { /* */ }
    }
  }

  function _isEmbedModeActive() {
    try {
      return !!(
        typeof document !== 'undefined' &&
        document.documentElement &&
        document.documentElement.dataset &&
        document.documentElement.dataset.embed
      );
    } catch (_) {
      return false;
    }
  }

  function openModal(slug, sourceEl, opts) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      try { console.warn('HT.embed.openModal: invalid slug'); } catch (_) { /* */ }
      return;
    }
    if (typeof document === 'undefined') return;
    // Suppress inside ?embed= mode — embed visitors can't embed-it-
    // further (the iframe would be a third-party embed of a third-
    // party embed; spec says it's nonsensical). Same skip pattern as
    // HT.share.mount (share.js:425-430).
    if (_isEmbedModeActive()) return;
    const state = _ensureModal(slug, sourceEl || null);
    // Allow opts.previewWidth/previewHeight to override the default
    // 320x240 (B3 a11y floor) at build time; the underlying build
    // happens once per slug, so opts only applies on first build.
    if (opts && state.previewEl && state.previewEl.parentNode) {
      if (typeof opts.previewWidth === 'number' && opts.previewWidth >= 240) {
        try { state.previewEl.setAttribute('width', String(opts.previewWidth)); } catch (_) { /* */ }
      }
      if (typeof opts.previewHeight === 'number' && opts.previewHeight >= 240) {
        try { state.previewEl.setAttribute('height', String(opts.previewHeight)); } catch (_) { /* */ }
      }
    }
    const dlg = state.dlg.dlg;
    if (typeof dlg.showModal === 'function') {
      try { dlg.showModal(); } catch (_) { /* already open */ }
    } else {
      try { dlg.setAttribute('open', ''); } catch (_) { /* */ }
    }
    // Focus the snippet element so the user can immediately copy
    // (Ctrl/Cmd+C after focus selects the text via the focus
    // handler). Fallback to the copy button if focus fails.
    if (state.snippetEl && typeof state.snippetEl.focus === 'function') {
      try { state.snippetEl.focus(); } catch (_) { /* */ }
    }
  }

  function closeModal() {
    _closeModal();
  }

  function isModalOpen() {
    if (!_modalState.dlg) return false;
    const dlg = _modalState.dlg.dlg;
    return !!(dlg && (dlg.open === true || dlg.hasAttribute('open')));
  }

  function button(slug, opts) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) return null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-ht-action', 'embed');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.className = 'embed-button btn--icon';
    btn.setAttribute('aria-label', 'Embed tool (e)');
    // Embed icon — a code-bracket pair (matching the conventional
    // "embed" affordance on CodePen, GitHub gist embeds, etc.).
    // 1.8 stroke matches chrome SVG weight convention.
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M16 18l6-6-6-6"/>' +
        '<path d="M8 6l-6 6 6 6"/>' +
      '</svg>';
    btn.addEventListener('click', function () {
      _modalState.sourceEl = btn;
      try { btn.setAttribute('aria-expanded', 'true'); } catch (_) { /* */ }
      openModal(slug, btn);
      // aria-expanded is reset by closeModal/_closeModal — but the
      // click handler also keeps it in sync if the user closes via
      // Esc or backdrop click.
    });
    // Listen for the dialog's `close` event to reset aria-expanded.
    btn.addEventListener('click', function once() {
      const dlg = _modalState.dlg && _modalState.dlg.dlg;
      if (dlg) {
        dlg.addEventListener('close', function () {
          try { btn.setAttribute('aria-expanded', 'false'); } catch (_) { /* */ }
        }, { once: true });
      }
    });
    return btn;
  }

  function mount(slug, rootEl) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      return { teardown: function () { /* no-op */ } };
    }
    if (!rootEl || !(rootEl.querySelector && rootEl.appendChild)) {
      return { teardown: function () { /* no-op */ } };
    }
    // Suppress in embed mode (mirror HT.share.mount).
    if (_isEmbedModeActive()) {
      return { teardown: function () { /* no-op */ } };
    }
    // Only mount for slugs that have an embed-snippet block — without
    // it, the modal has no snippet to render and no preview iframe
    // (the live preview section is conditional on hasEmbed).
    const schema = _resolveSnippetSchema(slug);
    if (!schema.hasEmbed) {
      return { teardown: function () { /* no-op */ } };
    }
    // Find or create the .tool-actions row.
    let row = rootEl.querySelector ? rootEl.querySelector('.tool-actions') : null;
    if (!row && rootEl.querySelector) {
      row = document.createElement('div');
      row.className = 'tool-actions';
      const firstSection = rootEl.querySelector('section, footer');
      if (firstSection) rootEl.insertBefore(row, firstSection);
      else rootEl.appendChild(row);
    }
    const btn = button(slug);
    if (row) {
      // Position AFTER the share button (Share is the primary
      // affordance; Embed is secondary — spec line "Embed button is
      // added to .tool-actions next to the Share button").
      const shareBtn = row.querySelector
        ? row.querySelector('[data-ht-action="share"]')
        : null;
      if (shareBtn && shareBtn.nextSibling) {
        row.insertBefore(btn, shareBtn.nextSibling);
      } else {
        row.appendChild(btn);
      }
    }
    return {
      teardown: function () {
        try { if (btn.parentNode) btn.parentNode.removeChild(btn); } catch (_) { /* */ }
        if (_modalState.dlg && _modalState.dlg.dlg && _modalState.dlg.dlg.parentNode) {
          try { _modalState.dlg.dlg.parentNode.removeChild(_modalState.dlg.dlg); } catch (_) { /* */ }
        }
        if (_modalState.slug === slug) {
          _modalState.dlg = null;
          _modalState.slug = null;
          _modalState.sourceEl = null;
          _modalState.snippetEl = null;
          _modalState.copyBtn = null;
          _modalState.previewEl = null;
          _modalState.previewLabelEl = null;
          _modalState.closeBtn = null;
        }
      },
    };
  }

  HT.embed = Object.freeze({
    publish: _publish,
    openModal: openModal,
    closeModal: closeModal,
    isModalOpen: isModalOpen,
    button: button,
    mount: mount,
    // Internal (handy for the smoke harness and unit tests):
    _renderSnippet: _renderSnippet,
    _resolveSnippetSchema: _resolveSnippetSchema,
    _resolveBase: _resolveBase,
    _escapeHtml: _escapeHtml,
  });

  Object.defineProperty(window, 'HT_EMBED_VERSION', {
    value: Object.freeze({ version: '1.1.0' }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();