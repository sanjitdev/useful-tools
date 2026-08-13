/* ============================================
   Handy Tools — share.js (Story 2.5)
   Per-Tool Share Dialog with URL + Print + Embed.
   The Shell exposes `HT.share` so every Tool can
   present the canonical URL, a print-friendly
   view, and an <iframe> embed snippet — no
   per-tool implementation drift. Composes on
   HT.copyToClipboard (utils.js) + HT.toast +
   HT.homeGrid.entries (splice). ES2018.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Slug validator — kebab-case per tools.schema.json
  // ^[a-z][a-z0-9-]*[a-z0-9]$.
  // -------------------------------------------------------------

  function _requireSlug(slug) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw new Error(
        'HT.share: slug must be kebab-case (^[a-z][a-z0-9-]*[a-z0-9]$); got ' +
          JSON.stringify(slug)
      );
    }
  }

  // -------------------------------------------------------------
  // Schema lookup — read the embed-snippet block from the
  // tools.json inline splice / HT.homeGrid.entries.
  // Mirrors HT.history._loadSchema's lookup path.
  // -------------------------------------------------------------

  function _findEntry(slug) {
    if (HT.homeGrid && Array.isArray(HT.homeGrid.entries)) {
      for (let i = 0; i < HT.homeGrid.entries.length; i += 1) {
        const e = HT.homeGrid.entries[i];
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
    return null;
  }

  function _loadSchema(slug) {
    const e = _findEntry(slug);
    if (!e) return null;
    const es = e['embed-snippet'];
    if (!es || typeof es !== 'object') return null;
    return Object.freeze({
      embedMinWidth: typeof es['min-width'] === 'number' ? es['min-width'] : 320,
      embedMinHeight: typeof es['min-height'] === 'number' ? es['min-height'] : 480,
      embedBadgeDefault: es['badge-default'] === true,
      title: typeof e.title === 'string' ? e.title : '',
    });
  }

  // -------------------------------------------------------------
  // HT.share.url(slug) — canonical URL is location.href. The
  // location.hash already encodes the codec state because
  // bindForm / HT.urlState.subscribe sync it on every change.
  // -------------------------------------------------------------

  function url(slug) {
    _requireSlug(slug);
    if (typeof location === 'undefined') return '';
    return location.href;
  }

  // -------------------------------------------------------------
  // HT.share.embedCode(slug) — <iframe> snippet. The width/height
  // come from tools.json embed-snippet.min-width/min-height (the
  // B3 a11y minimum is 240 per tools.schema.json).
  // Returns '' when the slug has no embed-snippet block.
  // -------------------------------------------------------------

  function _escapeAttr(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function embedCode(slug) {
    _requireSlug(slug);
    const schema = _loadSchema(slug);
    if (!schema) return '';
    const origin = (typeof location !== 'undefined' && location.origin)
      ? location.origin
      : '';
    const src = origin + '/tools/' + slug + '/';
    const w = Math.max(240, schema.embedMinWidth);
    const h = Math.max(240, schema.embedMinHeight);
    const title = _escapeAttr(schema.title || slug);
    return '<iframe src="' + _escapeAttr(src) + '" width="' + w + '" height="' + h +
      '" title="' + title + '" loading="lazy"></iframe>';
  }

  // -------------------------------------------------------------
  // HT.share.hasShare(slug) — synchronous predicate. Mirrors
  // HT.history.hasHistory: returns true iff the slug has a
  // urlState block (the share URL is meaningful only when
  // there's state to share).
  // -------------------------------------------------------------

  function hasShare(slug) {
    _requireSlug(slug);
    if (!HT.urlState || typeof HT.urlState._loadSchema !== 'function') return false;
    try {
      return HT.urlState._loadSchema(slug) !== null;
    } catch (_) {
      return false;
    }
  }

  // -------------------------------------------------------------
  // Dialog markup. Per AC-2: native <dialog> via showModal();
  // aria-labelledby + aria-describedby set from random IDs.
  // The dialog is built once and reused across open/close calls.
  // Tools MUST NOT call this directly — HT.share.mount is the
  // single insertion point.
  // -------------------------------------------------------------

  function _buildId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 10);
  }

  function _buildDialog(slug, opts) {
    const dlg = document.createElement('dialog');
    dlg.className = 'share-dialog';
    dlg.setAttribute('data-slug', slug);

    const titleId = _buildId('share-title');
    const descId = _buildId('share-desc');

    const schema = _loadSchema(slug);
    const hasEmbed = !!schema;
    const toolTitle = (schema && schema.title) || slug;

    const urlValue = url(slug);
    const embedValue = embedCode(slug);

    dlg.innerHTML =
      '<form method="dialog" class="share-form">' +
        '<header class="share-header">' +
          '<h2 id="' + titleId + '">Share ' + _escapeAttr(toolTitle) + '</h2>' +
          '<button type="button" data-ht-action="share-close" aria-label="Close (Esc)">×</button>' +
        '</header>' +
        '<p id="' + descId + '" class="share-desc">Copy the URL, print, or embed this tool.</p>' +

        '<section class="share-section" aria-labelledby="share-url-label">' +
          '<label id="share-url-label" for="share-url-input">Canonical URL</label>' +
          '<input type="url" id="share-url-input" readonly value="' + _escapeAttr(urlValue) + '">' +
          '<button type="button" data-ht-action="share-copy-url" class="btn btn--ghost">Copy URL</button>' +
        '</section>' +

        '<section class="share-section" aria-labelledby="share-print-label">' +
          '<label id="share-print-label">Print</label>' +
          '<p>Print this tool with the chrome hidden (no nav, no footer).</p>' +
          '<button type="button" data-ht-action="share-print" class="btn btn--primary">Print</button>' +
        '</section>' +

        '<section class="share-section" aria-labelledby="share-embed-label"' +
          (hasEmbed ? '' : ' hidden') + '>' +
          '<label id="share-embed-label" for="share-embed-input">Embed Code</label>' +
          '<textarea id="share-embed-input" readonly rows="3">' + _escapeAttr(embedValue) + '</textarea>' +
          '<button type="button" data-ht-action="share-copy-embed" class="btn btn--ghost">Copy embed code</button>' +
        '</section>' +
      '</form>';

    dlg.setAttribute('aria-labelledby', titleId);
    dlg.setAttribute('aria-describedby', descId);

    // Handlers
    const urlInput = dlg.querySelector('#share-url-input');
    const embedInput = dlg.querySelector('#share-embed-input');
    const copyUrlBtn = dlg.querySelector('[data-ht-action="share-copy-url"]');
    const printBtn = dlg.querySelector('[data-ht-action="share-print"]');
    const copyEmbedBtn = dlg.querySelector('[data-ht-action="share-copy-embed"]');
    const closeBtn = dlg.querySelector('[data-ht-action="share-close"]');

    function _copyUrl() {
      try {
        if (HT.copyToClipboard) HT.copyToClipboard(urlInput.value);
        if (HT.toast) HT.toast('URL copied', 2000);
      } catch (_) { /* clipboard fail already toasted by HT.copyToClipboard */ }
    }
    function _copyEmbed() {
      try {
        if (HT.copyToClipboard) HT.copyToClipboard(embedInput.value);
        if (HT.toast) HT.toast('Embed code copied', 2000);
      } catch (_) { /* same */ }
    }
    function _print() {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        try { window.print(); } catch (_) { /* no-op */ }
      }
    }

    if (copyUrlBtn) copyUrlBtn.addEventListener('click', _copyUrl);
    if (printBtn) printBtn.addEventListener('click', _print);
    if (copyEmbedBtn) copyEmbedBtn.addEventListener('click', _copyEmbed);
    if (closeBtn) closeBtn.addEventListener('click', function () { close(); });

    if (urlInput) {
      urlInput.addEventListener('focus', function () {
        try { urlInput.select(); } catch (_) { /* no-op */ }
      });
    }
    if (embedInput) {
      embedInput.addEventListener('focus', function () {
        try { embedInput.select(); } catch (_) { /* no-op */ }
      });
    }

    return {
      dlg: dlg,
      sourceEl: (opts && opts.sourceEl) || null,
      urlInput: urlInput,
      embedInput: embedInput,
    };
  }

  // -------------------------------------------------------------
  // Dialog state — single instance per page. Created lazily on
  // first open(); reused across open/close. The .share-button
  // aria-expanded toggles as the dialog opens/closes.
  // -------------------------------------------------------------

  const _state = {
    dlg: null,
    sourceEl: null,
    slug: null,
    button: null,
  };

  function _ensureDialog(slug, opts) {
    if (_state.dlg && _state.slug === slug) return _state;
    if (_state.dlg) {
      try { _state.dlg.dlg.parentNode.removeChild(_state.dlg.dlg); } catch (_) { /* no-op */ }
      _state.dlg = null;
    }
    const built = _buildDialog(slug, opts || {});
    const host = (typeof document !== 'undefined' && document.body)
      ? document.body
      : null;
    if (host) host.appendChild(built.dlg);
    _state.dlg = built;
    _state.slug = slug;
    _state.sourceEl = built.sourceEl;
    return _state;
  }

  // -------------------------------------------------------------
  // HT.share.open(slug, opts?) — open the dialog. Default focus
  // is the URL input (selected); opts.focus 'embed' focuses the
  // textarea; opts.focus 'print' opens + immediately calls
  // window.print(). opts.sourceEl is the element to re-focus on
  // close.
  // -------------------------------------------------------------

  function open(slug, opts) {
    _requireSlug(slug);
    if (typeof document === 'undefined') return;
    const state = _ensureDialog(slug, opts || {});
    state.sourceEl = (opts && opts.sourceEl) || state.sourceEl || null;

    const dlg = state.dlg.dlg;
    if (typeof dlg.showModal === 'function') {
      try { dlg.showModal(); } catch (_) { /* already open */ }
    } else {
      // Fallback: visible but no focus-trap. Still wire keyboard close.
      dlg.setAttribute('open', '');
    }

    // Toggle aria-expanded on the trigger button if known.
    if (state.button) {
      try { state.button.setAttribute('aria-expanded', 'true'); } catch (_) { /* no-op */ }
    }

    // Focus directive
    const focus = (opts && opts.focus) || 'url';
    if (focus === 'print') {
      // Print immediately; close after the print dialog exits.
      state.dlg.urlInput = state.dlg.urlInput;
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        try { window.print(); } catch (_) { /* no-op */ }
      }
      try { close(); } catch (_) { /* no-op */ }
      return;
    }
    const target = (focus === 'embed' && state.dlg.embedInput)
      ? state.dlg.embedInput
      : state.dlg.urlInput;
    if (target && typeof target.focus === 'function') {
      try { target.focus(); } catch (_) { /* no-op */ }
    }
  }

  // -------------------------------------------------------------
  // HT.share.close() — closes the dialog and returns focus to
  // opts.sourceEl (the trigger button by default).
  // -------------------------------------------------------------

  function close() {
    if (!_state.dlg) return;
    const dlg = _state.dlg.dlg;
    try {
      if (typeof dlg.close === 'function' && dlg.open) dlg.close();
      else dlg.removeAttribute('open');
    } catch (_) { /* no-op */ }
    if (_state.button) {
      try { _state.button.setAttribute('aria-expanded', 'false'); } catch (_) { /* no-op */ }
    }
    if (_state.sourceEl && typeof _state.sourceEl.focus === 'function') {
      try { _state.sourceEl.focus(); } catch (_) { /* no-op */ }
    }
  }

  // -------------------------------------------------------------
  // HT.share.isOpen() — true iff the dialog exists and is open.
  // -------------------------------------------------------------

  function isOpen() {
    if (!_state.dlg) return false;
    const dlg = _state.dlg.dlg;
    return !!(dlg && (dlg.open === true || dlg.hasAttribute('open')));
  }

  // -------------------------------------------------------------
  // HT.share.button(slug, opts?) — factory for the trigger
  // button. Click opens the dialog. aria-expanded toggles.
  // -------------------------------------------------------------

  function button(slug, opts) {
    _requireSlug(slug);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-ht-action', 'share');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    const variant = (opts && opts.variant) || 'icon';
    if (variant === 'icon') {
      btn.className = 'share-button btn--icon';
      btn.textContent = '↗';
      btn.setAttribute('aria-label', 'Share tool (s)');
    } else if (variant === 'link') {
      btn.className = 'share-button btn--link';
      btn.textContent = 'Share';
      btn.setAttribute('aria-label', 'Share tool (s)');
    } else {
      btn.className = 'share-button btn--ghost';
      btn.textContent = 'Share';
      btn.setAttribute('aria-label', 'Share tool (s)');
    }
    btn.addEventListener('click', function () {
      // Pre-warm the dialog state so open() picks up the right button.
      _state.button = btn;
      open(slug, { sourceEl: btn });
    });
    return btn;
  }

  // -------------------------------------------------------------
  // HT.share.mount(slug, rootEl) — Shell-side insertion helper.
  // Inserts the share button into the .tool-actions row (creating
  // one if missing) and renders the <dialog> lazily on first open.
  // Returns {teardown} that removes the button + dialog.
  // -------------------------------------------------------------

  function mount(slug, rootEl) {
    _requireSlug(slug);
    if (!rootEl || !(rootEl instanceof HTMLElement || (rootEl.querySelector && rootEl.appendChild))) {
      return { teardown: function () { /* no-op */ } };
    }
    if (!hasShare(slug)) {
      return { teardown: function () { /* no-op */ } };
    }

    // In ?embed=1 mode the share button is suppressed (Story 1.7 AD-4
    // mirrors the same skip applied elsewhere for embedded UI).
    if (typeof location !== 'undefined' && location.search &&
        /[?&]embed=1(?:&|$)/.test(location.search)) {
      return { teardown: function () { /* no-op */ } };
    }

    // Find or create the .tool-actions row.
    let row = rootEl.querySelector ? rootEl.querySelector('.tool-actions') : null;
    if (!row && rootEl.querySelector) {
      row = document.createElement('div');
      row.className = 'tool-actions';
      // Insert before the first <section> or <footer>; fallback to append.
      const firstSection = rootEl.querySelector('section, footer');
      if (firstSection) rootEl.insertBefore(row, firstSection);
      else rootEl.appendChild(row);
    }

    const btn = button(slug, { variant: 'icon' });
    if (row) {
      // Position the share button BEFORE any history button if present
      // (spec line 68 — share is the first affordance in the actions row).
      const historyBtn = row.querySelector ? row.querySelector('[data-ht-history-button], .history-button') : null;
      if (historyBtn) row.insertBefore(btn, historyBtn);
      else row.appendChild(btn);
    }
    _state.button = btn;

    // Pre-build the dialog so the first open is instant.
    const built = _buildDialog(slug, { sourceEl: btn });
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(built.dlg);
    } else {
      rootEl.appendChild(built.dlg);
    }
    _state.dlg = built;
    _state.slug = slug;
    _state.sourceEl = btn;

    return {
      teardown: function () {
        try { if (btn.parentNode) btn.parentNode.removeChild(btn); } catch (_) { /* no-op */ }
        try { if (built.dlg.parentNode) built.dlg.parentNode.removeChild(built.dlg); } catch (_) { /* no-op */ }
        if (_state.dlg === built) {
          _state.dlg = null;
          _state.slug = null;
          _state.sourceEl = null;
          _state.button = null;
        }
      },
    };
  }

  // -------------------------------------------------------------
  // HT.share.print(slug) — convenience for tools that want a
  // Print affordance without triggering the full Share dialog UI
  // (e.g. legacy tools with a custom #print-btn). Calls
  // window.print() directly (no dialog render) — the Shell's
  // @media print block hides chrome so the tool's <main> prints
  // cleanly. Gate-allowlisted in shell-bounds-check.py so tools
  // can use this without bypassing the bypass gate.
  // -------------------------------------------------------------

  function print(slug) {
    _requireSlug(slug);
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      try { window.print(); } catch (_) { /* no-op */ }
    }
  }

  // -------------------------------------------------------------
  // Public surface — frozen per AD-14.
  // -------------------------------------------------------------

  Object.freeze(url);
  Object.freeze(embedCode);
  Object.freeze(hasShare);
  Object.freeze(open);
  Object.freeze(close);
  Object.freeze(isOpen);
  Object.freeze(button);
  Object.freeze(mount);
  Object.freeze(print);
  Object.freeze(_loadSchema);

  Object.defineProperties(HT, {
    share: {
      value: Object.freeze({
        version: '1.8.0',
        url: url,
        embedCode: embedCode,
        hasShare: hasShare,
        open: open,
        close: close,
        isOpen: isOpen,
        button: button,
        mount: mount,
        print: print,
        // Internal:
        _loadSchema: _loadSchema,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });
})();
