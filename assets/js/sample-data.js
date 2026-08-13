/* ============================================
   Handy Tools — sample-data.js (Story 2.2)
   Per-Tool Sample Data and Reset Button.
   Exposes `HT.sampleData` and `HT.reset` so
   every Tool gets a Shell-mounted "Try an
   example" affordance and a "Reset to sample"
   action — no per-tool drift. Composes on
   HT.urlState._loadSchema. ES2018.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Schema access — delegate to url.js's frozen _loadSchema.
  // Re-declaring the cache or re-parsing tools.json would create
  // drift, so this module is a thin facade.
  // -------------------------------------------------------------

  function _schema(slug) {
    if (!HT.urlState || typeof HT.urlState._loadSchema !== 'function') {
      throw new Error(
        'HT.sampleData: HT.urlState._loadSchema is unavailable — ' +
        'load assets/js/url.js BEFORE assets/js/sample-data.js'
      );
    }
    return HT.urlState._loadSchema(slug);
  }

  function _entry(slug) {
    // url.js's _loadSchema returns the resolved schema, not the
    // raw entry. To read `urlState.sample` and `urlState.default`
    // we need the underlying entry — re-resolve via HT.homeGrid
    // or the inline JSON splice (mirrors url.js's _resolveEntry).
    if (typeof slug !== 'string') return null;
    if (HT.homeGrid && Array.isArray(HT.homeGrid.entries)) {
      for (let i = 0; i < HT.homeGrid.entries.length; i += 1) {
        const e = HT.homeGrid.entries[i];
        if (e && e.slug === slug) return e;
      }
    }
    const inline = typeof document !== 'undefined'
      ? document.getElementById('ht-tools-json-inline')
      : null;
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
    return null;
  }

  function _urlStateOf(slug) {
    const e = _entry(slug);
    return (e && e.urlState && typeof e.urlState === 'object') ? e.urlState : null;
  }

  // -------------------------------------------------------------
  // HT.sampleData
  // -------------------------------------------------------------

  function fill(slug) {
    const us = _urlStateOf(slug);
    if (!us) return null;
    const def = (us.default && typeof us.default === 'object') ? us.default : null;
    const sample = (us.sample && typeof us.sample === 'object') ? us.sample : null;
    if (!def && !sample) return null;
    const merged = Object.assign({}, def || {}, sample || {});
    // A tool with both blocks present but empty (e.g. default={}, no sample)
    // has no payload to restore to — return null so reset/load treats it
    // as a no-op and the Shell mount helper declines to render the row.
    if (Object.keys(merged).length === 0) return null;
    // Object.freeze the merged result so callers cannot mutate
    // the canonical sample payload. Sloppy-mode mutations fail
    // silently; the smoke harness asserts Object.isFrozen.
    return Object.freeze(merged);
  }

  function hasSample(slug) {
    const us = _urlStateOf(slug);
    if (!us || !us.sample || typeof us.sample !== 'object') return false;
    return Object.keys(us.sample).length > 0;
  }

  function button(slug, opts) {
    const label = (opts && typeof opts.label === 'string' && opts.label.length)
      ? opts.label
      : 'Try an example';
    // Default variant is `link` (a discreet underlined text) so the
    // row of affordances doesn't compete with the tool's primary
    // CTA at the top of the page. Callers can opt back into the
    // solid ghost/destructive style via opts.variant.
    const variant = (opts && (opts.variant === 'ghost' || opts.variant === 'link'))
      ? opts.variant
      : 'link';
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.htAction = 'sample';
    // BEM button variants + the .btn base class so the button picks
    // up the shared .btn sizing / focus / hover rules from
    // assets/css/components.css. Without .btn, the button rendered
    // as UA-default chrome that read as a plain link at the top of
    // the page.
    b.className = 'btn ' + (
      variant === 'ghost' ? 'btn--ghost' : 'btn--link'
    );
    b.textContent = label;
    // aria-label surfaces the shortcut key per EXPERIENCE.md §6.5.
    // The actual key-binding lands in Story 3.3.
    b.setAttribute('aria-label', label + ' (s)');
    // P-10: the click listener is attached by mount() so it can be
    // tracked + detached in teardown. button() is a pure factory.
    return b;
  }

  function _runSample(slug) {
    const payload = fill(slug);
    if (!payload) return;
    const main = typeof document !== 'undefined'
      ? document.querySelector('main[data-slug="' + slug + '"]')
      : null;
    if (!main) return;
    _writeStateToDom(main, payload);
    _focusFirstInput(main);
    _commitHashFromDom(main, slug);
  }

  // -------------------------------------------------------------
  // HT.reset
  // -------------------------------------------------------------

  function run(slug, opts) {
    // Public façade for HT.reset (Story 2.2). Per the canonical Epic
    // 2.2 AC: reset restores the SAMPLE values, not the bare default.
    // Delegates to fill(slug) which returns sample merged on top of
    // default — so a tool with both blocks resets to the merged
    // payload, a tool with only default resets to default, and a tool
    // with neither is a no-op (no button rendered in that case).
    //
    // opts.confirm === false skips the dialog (used by the dialog's
    // own confirm callback, which routes back through this same façade
    // so the write path is canonical — Story 2.2 DN-2).
    const payload = fill(slug);
    if (!payload) return;
    const main = typeof document !== 'undefined'
      ? document.querySelector('main[data-slug="' + slug + '"]')
      : null;
    if (!main) return;

    const confirmRequested = !(opts && opts.confirm === false);

    if (!confirmRequested) {
      _doReset(slug, main, payload);
      return;
    }

    const currentState = _readStateFromDom(main, slug);
    const isDirty = !_payloadsEqual(currentState, payload);
    if (!isDirty) {
      // State already matches the reset target — write to normalize
      // history/hash and focus the first input as a UX nudge, but do
      // not prompt the user to confirm a no-op.
      _doReset(slug, main, payload);
      return;
    }
    _confirmDestructive(main, slug, function () {
      run(slug, { confirm: false });
    });
  }

  function _doReset(slug, main, payload) {
    _writeStateToDom(main, payload);
    _clearHash();
    _focusFirstInput(main);
  }

  function resetButton(slug, opts) {
    const label = (opts && typeof opts.label === 'string' && opts.label.length)
      ? opts.label
      : 'Reset to sample';
    // Default variant is `link` (a discreet underlined text) so the
    // destructive action doesn't compete with the tool's primary CTA
    // at the top of the page. Callers can opt back into the solid
    // destructive style via opts.variant === 'destructive'.
    const variant = (opts && (opts.variant === 'destructive' || opts.variant === 'ghost'))
      ? opts.variant
      : 'link';
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.htAction = 'reset';
    // BEM button variants + the .btn base class so the button picks
    // up the shared .btn sizing / focus / hover rules.
    b.className = 'btn ' + (
      variant === 'destructive' ? 'btn--destructive' :
      variant === 'ghost' ? 'btn--ghost' :
      'btn--link'
    );
    b.textContent = label;
    // aria-label is canonical ("Reset to sample (r)") regardless
    // of opts.label override (which only changes visible text).
    b.setAttribute('aria-label', 'Reset to sample (r)');
    // P-10: click listener is attached by mount() so it can be tracked
    // + detached in teardown. resetButton() is a pure factory.
    return b;
  }

  // -------------------------------------------------------------
  // mount(slug, rootEl) — Shell-side helper. Renders both buttons
  // into a `.tool-actions` flex row when applicable.
  // -------------------------------------------------------------

  function mount(slug, rootEl) {
    if (!rootEl || typeof rootEl.querySelector !== 'function') {
      throw new Error('HT.sampleData.mount: rootEl must be a DOM element');
    }
    // P-8: resolve _urlStateOf(slug) once instead of 4×.
    const us = _urlStateOf(slug);
    const hasSampleBlock = hasSample(slug);
    const hasDefaults = !!(
      us && us.default && typeof us.default === 'object' &&
      Object.keys(us.default).length > 0
    );
    const hasSamplePayload = !!fill(slug);

    let row = rootEl.querySelector('.tool-actions');
    if (!row) {
      row = document.createElement('div');
      row.className = 'tool-actions';
      // Placement policy (Story 2.2 + recent reset-button placement
      // fix): the .tool-actions row always renders next to (or just
      // below) the tool title — never ABOVE the back-link.
      //
      //   1. If the page declares a `.tool-actions` slot (e.g. via
      //      `assets/shell/template.html`'s `<div class="tool-actions">`),
      //      use it. The Shell-mounted slot lives at the top of the
      //      tool area and already has the correct styling.
      //   2. Else if `<form>` exists, insert before the form (the
      //      action buttons sit just above the user's inputs).
      //   3. Else insert AFTER the `<header class="tool-header">` if
      //      present, so the buttons sit underneath the back-link +
      //      h1 — never pushed to the very top where they read as a
      //      broken back-link.
      //   4. Else fall back to append at the end of rootEl.
      const toolHeader = rootEl.querySelector('.tool-header');
      const firstForm = rootEl.querySelector('form');
      if (firstForm && firstForm.parentNode === rootEl) {
        rootEl.insertBefore(row, firstForm);
      } else if (toolHeader && toolHeader.parentNode === rootEl) {
        if (toolHeader.nextSibling) {
          rootEl.insertBefore(row, toolHeader.nextSibling);
        } else {
          rootEl.appendChild(row);
        }
      } else {
        // No structural anchor — append. (The earlier code inserted
        // before rootEl.firstChild, which put the row ABOVE the
        // back-link and made it read as a duplicate link / leftover
        // chrome — a real UX bug.)
        rootEl.appendChild(row);
      }
    }

    const sampleBtn = hasSampleBlock ? button(slug) : null;
    const resetBtn = (hasDefaults || hasSamplePayload) ? resetButton(slug) : null;

    // P-10: track listener functions so teardown can detach them
    // alongside removing the DOM nodes (AC-4 step 5). button() and
    // resetButton() are pure factories — listeners are wired here.
    const listeners = [];
    function _tagWithListener(btn, fn) {
      listeners.push({ btn, fn });
      btn.addEventListener('click', fn);
    }
    function _onSampleClick(ev) {
      ev.preventDefault();
      _runSample(slug);
    }
    function _onResetClick(ev) {
      ev.preventDefault();
      run(slug, { confirm: true });
    }
    if (sampleBtn) _tagWithListener(sampleBtn, _onSampleClick);
    if (resetBtn) _tagWithListener(resetBtn, _onResetClick);

    const inserted = [];
    if (sampleBtn) { row.appendChild(sampleBtn); inserted.push(sampleBtn); }
    if (resetBtn) { row.appendChild(resetBtn); inserted.push(resetBtn); }

    return {
      teardown: function () {
        for (let i = 0; i < listeners.length; i += 1) {
          const { btn, fn } = listeners[i];
          try { btn.removeEventListener('click', fn); } catch (_) {}
        }
        for (let i = 0; i < inserted.length; i += 1) {
          try { inserted[i].parentNode.removeChild(inserted[i]); } catch (_) {}
        }
        if (row && row.childNodes.length === 0 && row.parentNode) {
          try { row.parentNode.removeChild(row); } catch (_) {}
        }
      },
    };
  }

  // -------------------------------------------------------------
  // DOM helpers — read/write form state via url.js's write path.
  // We mirror the write-path behavior from bindForm rather than
  // touching the internal _writeFieldValue (which isn't part of
  // the public surface). The smoke harness tests these helpers
  // indirectly via the button click handler.
  // -------------------------------------------------------------

  function _resolveFieldEl(rootEl, entry) {
    const sel = entry.to || entry.from;
    if (typeof sel === 'string' && sel.length > 0) {
      try { return rootEl.querySelector(sel); } catch (_) { return null; }
    }
    if (typeof entry.key === 'string' && entry.key.length > 0) {
      return rootEl.querySelector('#' + entry.key);
    }
    return null;
  }

  function _writeFieldValue(el, value) {
    if (!el) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') {
        el.checked = value === true || value === '1' || value === 'true';
      } else {
        el.value = value === undefined || value === null ? '' : String(value);
      }
      return;
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.value = value === undefined || value === null ? '' : String(value);
      return;
    }
    if ('value' in el) el.value = value === undefined || value === null ? '' : String(value);
  }

  function _readFieldValue(el) {
    if (!el) return undefined;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked ? '1' : '0';
      if (el.type === 'number') return el.value === '' ? '' : Number(el.value);
      return el.value;
    }
    if (el instanceof HTMLTextAreaElement) return el.value;
    if (el instanceof HTMLSelectElement) return el.value;
    return el.value;
  }

  function _writeStateToDom(rootEl, payload) {
    const schema = _schema(_slugFromRoot(rootEl));
    for (let i = 0; i < schema.decode.length; i += 1) {
      const entry = schema.decode[i];
      if (!Object.prototype.hasOwnProperty.call(payload, entry.key)) continue;
      const el = _resolveFieldEl(rootEl, entry);
      _writeFieldValue(el, payload[entry.key]);
    }
  }

  function _readStateFromDom(rootEl, slug) {
    const schema = _schema(slug);
    const out = {};
    for (let i = 0; i < schema.encode.length; i += 1) {
      const entry = schema.encode[i];
      const el = _resolveFieldEl(rootEl, entry);
      const v = _readFieldValue(el);
      if (v === undefined || v === '') continue;
      out[entry.key] = v;
    }
    return out;
  }

  function _slugFromRoot(rootEl) {
    if (!rootEl) return null;
    const main = rootEl.closest && rootEl.closest('main[data-slug]');
    if (main) return main.getAttribute('data-slug');
    return rootEl.getAttribute && rootEl.getAttribute('data-slug');
  }

  function _commitHashFromDom(rootEl, slug) {
    if (!HT.urlState || typeof HT.urlState.encode !== 'function') return;
    const state = _readStateFromDom(rootEl, slug);
    let encoded;
    try { encoded = HT.urlState.encode(slug, state); }
    catch (e) { /* tolerate encode errors — bindForm will retry on input */ return; }
    const nextHash = encoded ? '#' + encoded : '';
    if ((typeof location !== 'undefined') && (location.hash || '') !== nextHash) {
      try {
        history.replaceState(null, '', nextHash || location.pathname + location.search);
      } catch (_) {
        // Some embed contexts disallow history mutation; fall back.
        if (typeof location !== 'undefined') location.hash = encoded;
      }
    }
  }

  function _clearHash() {
    if (typeof location === 'undefined') return;
    try {
      history.replaceState(null, '', location.pathname + location.search);
    } catch (_) {
      // Fall back: set hash to empty string. Older browsers without
      // replaceState can use this.
      location.hash = '';
    }
  }

  function _focusFirstInput(rootEl) {
    if (!rootEl || typeof rootEl.querySelector !== 'function') return;
    const first = rootEl.querySelector('input, select, textarea');
    if (first && typeof first.focus === 'function') {
      try { first.focus({ preventScroll: false }); } catch (_) { first.focus(); }
    }
  }

  function _payloadsEqual(a, b) {
    // P-6: use a symmetric key set so DOM-only fields (typed by the
    // user into a default-only or sample-only schema) don't cause
    // the dirty check to silently pass.
    const keys = Array.from(new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {}),
    ]));
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const av = a ? a[k] : undefined;
      const bv = b ? b[k] : undefined;
      // P-7: dead branch removed (was unreachable after the === short-circuit).
      if (String(av) !== String(bv)) return false;
    }
    return true;
  }

  // -------------------------------------------------------------
  // Confirm modal — inline <dialog> with destructive styling.
  // Returns focus to the reset button on close.
  // -------------------------------------------------------------

  function _confirmDestructive(rootEl, slug, onConfirm) {
    const dlg = document.createElement('dialog');
    dlg.className = 'ht-confirm-dialog';
    dlg.setAttribute('aria-labelledby', 'ht-confirm-title');
    const titleId = 'ht-confirm-title-' + Math.random().toString(36).slice(2, 8);
    dlg.innerHTML =
      '<form method="dialog" class="ht-confirm-form">' +
        '<h2 id="' + titleId + '" class="ht-confirm-title">Reset to sample?</h2>' +
        '<p class="ht-confirm-body">Your current inputs differ from the sample values. This will discard them.</p>' +
        '<div class="ht-confirm-actions">' +
          '<button type="button" value="cancel" class="btn btn--ghost" data-ht-action="reset-cancel">Cancel</button>' +
          '<button type="button" value="confirm" class="btn btn--destructive" data-ht-action="reset-confirm">Reset to sample</button>' +
        '</div>' +
      '</form>';
    dlg.querySelector('[aria-labelledby]') &&
      dlg.querySelector('h2').setAttribute('id', titleId);
    dlg.querySelector('h2').id = titleId;
    dlg.setAttribute('aria-labelledby', titleId);

    const cancelBtn = dlg.querySelector('[data-ht-action="reset-cancel"]');
    const confirmBtn = dlg.querySelector('[data-ht-action="reset-confirm"]');
    const trigger = rootEl.querySelector('[data-ht-action="reset"]');

    function _close(result) {
      try { dlg.close(); } catch (_) {}
      try { dlg.parentNode.removeChild(dlg); } catch (_) {}
      if (result && typeof onConfirm === 'function') onConfirm();
      if (trigger && typeof trigger.focus === 'function') trigger.focus();
    }

    cancelBtn.addEventListener('click', function () { _close(false); });
    confirmBtn.addEventListener('click', function () { _close(true); });
    dlg.addEventListener('cancel', function (ev) {
      ev.preventDefault();
      _close(false);
    });

    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') {
      try { dlg.showModal(); } catch (_) { _close(false); return; }
    } else {
      // Fallback for browsers without <dialog>: skip confirmation
      // and proceed (Story 2.2 still ships the affordance; the
      // destructive visual treatment just degrades).
      try { dlg.parentNode.removeChild(dlg); } catch (_) {}
      if (typeof onConfirm === 'function') onConfirm();
    }
    confirmBtn.focus();
  }

  // -------------------------------------------------------------
  // Public surface — frozen per AD-14.
  // -------------------------------------------------------------

  Object.freeze(fill);
  Object.freeze(hasSample);
  Object.freeze(button);
  Object.freeze(resetButton);
  Object.freeze(run);
  Object.freeze(mount);

  Object.defineProperties(HT, {
    sampleData: {
      value: Object.freeze({
        version: '1.0.0',
        fill: fill,
        button: button,
        hasSample: hasSample,
        mount: mount,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
    reset: {
      value: Object.freeze({
        version: '1.0.0',
        run: run,
        button: resetButton,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });
})();
