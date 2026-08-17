/* date-picker-v2 / core.js
 *
 * Module-level single source of truth for the open picker.
 *
 * The hotfix-5 bug class was: `restore.focus()` on close fired a
 * focus event on the source input, which re-entered the open
 * code path and re-opened the dialog. The structural fix here:
 *
 *   1. There is exactly ONE opener and ONE closer (`_open` and
 *      `_close`). They read / write `currentOpenInput`.
 *   2. The dialog uses `showModal()` so Escape is handled by the
 *      browser — no keydown listener, no `restore.focus()`.
 *   3. Backdrop click uses the dialog's native click-on-padding
 *      event: when the user clicks outside the form (i.e. on the
 *      dialog element itself, not on a child), the dialog is
 *      closed via the close handler. No document-capture listener.
 *   4. There is no flag soup (`_suppressOpen`, `_lastCloseTs`,
 *      etc.) — only `currentOpenInput`. If it's set and you call
 *      open() for the same input, you re-open the existing
 *      dialog. If it's set and you call open() for a different
 *      input, you close the first and open the second.
 *
 * The dialog is mounted once per enhanced input. Re-opening
 * re-uses the same DOM node — `showModal()` toggles it back on.
 */

'use strict';

(function (root) {
  var NS = root.HT = root.HT || {};
  NS.datePickerV2 = NS.datePickerV2 || {};
  var DPV = NS.datePickerV2;

  // Module-level single source of truth.
  var currentOpenInput = null;

  // Per-input state registry. Keyed by `input._dpv2_id` so we
  // can look up state by either input element or input id.
  var states = Object.create(null);
  var nextStateId = 1;

  function nextId() {
    return 'dpv2-' + (nextStateId++);
  }

  // Type detection from the input element's `type` attribute.
  function typeFor(input) {
    var t = input && input.type;
    if (t === 'date' || t === 'time' || t === 'datetime-local') return t;
    return null;
  }

  // Look up state for an input element.
  function stateFor(input) {
    if (!input) return null;
    var key = input._dpv2_id;
    return key ? states[key] || null : null;
  }

  // Look up state by id (used by HT.datePickerV2.openById etc).
  function stateById(id) {
    if (!id) return null;
    // Strip the "dpv2-" prefix if the caller passed the raw id
    // (the public API uses the input's own id, not the state id).
    // We look up by iterating since id→input lookup isn't a
    // primary key.
    for (var k in states) {
      if (Object.prototype.hasOwnProperty.call(states, k)) {
        var s = states[k];
        if (s.input && s.input.id === id) return s;
      }
    }
    return null;
  }

  // Public lookup: input element → state.
  function enhance(input, opts) {
    if (!input || input.nodeType !== 1) {
      throw new Error('date-picker-v2.enhance: input element required');
    }
    // Idempotent — calling enhance twice on the same input is a
    // no-op and returns the existing handle. The smoke harness
    // depends on this. Checked BEFORE the type validation because
    // enhance() swaps the input's `type` from "date|time|..." to
    // "text" to suppress the OS-native picker; a second call would
    // then trip the type check below if we didn't short-circuit.
    var existing = stateFor(input);
    if (existing) return existing._public;

    var t = typeFor(input);
    if (!t) {
      throw new Error('date-picker-v2.enhance: input must be type=date|time|datetime-local');
    }

    opts = opts || {};
    var state = {
      id: nextId(),
      type: t,
      input: input,
      onSelect: typeof opts.onSelect === 'function' ? opts.onSelect : null,
      onOpen: typeof opts.onOpen === 'function' ? opts.onOpen : null,
      onClose: typeof opts.onClose === 'function' ? opts.onClose : null,
      _dlg: null,       // the dialog DOM element (lazy)
      _isOpen: false,
      // Set to true by the dialog 'close' listener when the native
      // <dialog> returns focus to the source input. Without this,
      // that focus event would re-enter onFocus() and re-open the
      // picker (the hotfix-5 bug class). This is the structural
      // replacement for the old picker's _suppressOpen flag — it's
      // set on close and consumed by the next focus event only.
      _suppressNextFocus: false,
      // The mousedown handler calls preventDefault() so the
      // browser doesn't open its native picker AFTER we open ours
      // (race / flicker). We only preventDefault when WE will open
      // a dialog — otherwise the user might be typing in the
      // input via mousedown (e.g. selecting text) and we shouldn't
      // interfere.
      _suppressNextMouseDown: false,
      // Phase 2 visual fix — save the original `type` so we can
      // restore it on destroy(). We swap `type="date|time|...`
      // for `type="text"` while enhanced, because calling
      // preventDefault() on the click event is NOT a reliable way
      // to suppress the OS-native picker across browsers (Chrome,
      // Edge, and Safari each behave differently, and some versions
      // open the native picker BEFORE the click event fires).
      // Changing the type guarantees the native picker never
      // appears at all. The input's value is still set/read as a
      // plain string (which is what we need for ISO date/time
      // strings anyway), so wire format is unaffected.
      _originalType: (function () {
        try { return input.getAttribute('type'); } catch (_) {}
        return input.type || t;
      })(),
    };
    // Swap the input's type so the OS-native picker can't launch.
    // Use both setAttribute AND the IDL property because some
    // browsers mirror type changes through one channel and not
    // the other. Wrapped because synthetic test inputs may not
    // expose either interface.
    try { input.setAttribute('type', 'text'); } catch (_) {}
    try { input.type = 'text'; } catch (_) {}
    input._dpv2_id = state.id;
    states[state.id] = state;

    // ----- wire focus + mousedown listeners -----
    //
    // Why focus, not just click:
    //   * Keyboard users expect Tab to focus the input and Enter
    //     to open the picker. Enter fires `click`, but a screen-
    //     reader user navigating by keyboard gets `focus` first
    //     and expects the picker to surface.
    //   * Match the old picker's behavior (date-picker.js:2172).
    //
    // Why mousedown suppress:
    //   * Without preventDefault, mousedown on the picker affordance
    //     (the calendar icon) opens the native picker; the v2
    //     dialog then opens on the subsequent focus/click. Two
    //     pickers at once is ugly.
    //
    // Re-open prevention (the hotfix-5 bug class):
    //   * When the dialog closes (via 'close' event), the browser
    //     returns focus to the source input. That fires `focus` on
    //     this listener. We set _suppressNextFocus on close so the
    //     next focus event is consumed without calling _open().
    //   * This is structurally simpler than the old picker's
    //     _suppressOpen/_lastCloseTs soup — there's only one
    //     suppression flag and it's always cleared after one use.
    function onFocus() {
      if (state._suppressNextFocus) {
        state._suppressNextFocus = false;
        return;
      }
      _open(state);
    }
    function onMouseDown(ev) {
      // Modern browsers open the native picker on the `click`
      // event (not mousedown), so preventDefault on mousedown
      // alone is not enough — we also swallow the click. The
      // v2 dialog has already been opened by the focus handler
      // (which fires between mousedown and click on every browser
      // we support), so preventing the click default only stops
      // the native picker from launching alongside it.
      //
      // The keyboard path (Tab to focus, then Space/Enter) also
      // produces a `click` event in some browsers, so the click
      // suppression covers both.
      state._suppressNextMouseDown = true;
      try { ev.preventDefault(); } catch (_) {}
    }
    function onClick(ev) {
      // Phase 2 fix (the picker was showing BOTH the v2 dialog
      // and the OS native picker because preventDefault on
      // mousedown doesn't reliably block the date input's own
      // click handler). v2's focus handler has already opened
      // our dialog by the time click fires; preventDefault here
      // stops the native picker from appearing on top.
      try { ev.preventDefault(); } catch (_) {}
      try { ev.stopPropagation(); } catch (_) {}
      // _open() is already on the call stack from the focus event
      // (which fires synchronously between mousedown and click on
      // mouse input, and from the same activation on keyboard).
      // _open's single-opener rule makes it idempotent.
    }
    state._focusHandler = onFocus;
    state._mouseDownHandler = onMouseDown;
    state._clickHandler = onClick;
    input.addEventListener('focus', onFocus);
    input.addEventListener('mousedown', onMouseDown);
    input.addEventListener('click', onClick);

    // Wire the commit callback used by the dialog builder. Writes
    // to input.value, fires `input` then `change`, calls onSelect,
    // and closes the dialog.
    state._commitValue = function (newValue) {
      if (input.value === newValue) {
        _close(state);
        return;
      }
      input.value = newValue;
      // input event — required by tools that listen to "input"
      // (most don't, but some do for live recompute).
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (_) {}
      try {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
      if (state.onSelect) {
        try { state.onSelect(newValue); } catch (_) {}
      }
      _close(state);
    };

    state._public = Object.freeze({
      open: function () { _open(state); },
      close: function () { _close(state); },
      destroy: function () { _destroy(state); },
      isOpen: function () { return state._isOpen; },
      _state: state,
    });
    return state._public;
  }

  function _ensureDialog(state) {
    if (state._dlg && state._dlg.isConnected) return state._dlg;
    DPV.css.inject();
    var dlg = DPV.dialogs.build(state);
    document.body.appendChild(dlg);
    state._dlg = dlg;

    // Wire close listener — the browser fires `close` on the
    // dialog when:
    //   (a) the user presses Escape (showModal native behavior)
    //   (b) the form submits (method="dialog")
    //   (c) we call dlg.close() programmatically
    // We don't need a keydown listener — Escape is native.
    dlg.addEventListener('close', function () {
      // Set _isOpen BEFORE invoking onClose so the callback can
      // check state._isOpen if it needs to.
      var wasOpen = state._isOpen;
      state._isOpen = false;
      if (currentOpenInput === state.input) currentOpenInput = null;
      // The browser returns focus to the source input when the
      // dialog closes (per <dialog>'s spec for showModal). That
      // focus event would re-enter _open() and re-open the picker
      // — the hotfix-5 bug class. Arm _suppressNextFocus so the
      // onFocus listener consumes the next focus event silently.
      state._suppressNextFocus = true;
      if (wasOpen && state.onClose) {
        try { state.onClose(state.input, state.input.value); } catch (_) {}
      }
    });

    // Backdrop click — when the user clicks on the dialog's
    // padding area (i.e. outside the form), the click target is
    // the dialog element itself. We close in that case. Clicks
    // inside the form (on the grid, on cells, on buttons) have
    // a different target and are left alone.
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) {
        dlg.close();
      }
    });

    return dlg;
  }

  function _open(state) {
    if (!state || !state.input) return;
    // Single-opener rule: if this input is already open, do
    // nothing. Don't toggle — the close path will clear state.
    if (currentOpenInput === state.input && state._isOpen) return;

    // Switching inputs: close the current first. We do this
    // synchronously (no Promise) so the new open happens
    // immediately after.
    if (currentOpenInput && currentOpenInput !== state.input) {
      var prevState = stateFor(currentOpenInput);
      if (prevState && prevState._dlg && prevState._isOpen) {
        // .close() fires the dialog 'close' event which clears
        // currentOpenInput. We set it back below.
        prevState._dlg.close();
      }
    }

    var dlg = _ensureDialog(state);
    state._isOpen = true;
    currentOpenInput = state.input;
    // showModal() opens the dialog AND traps focus inside it
    // AND installs a backdrop. No focus stealing — the input
    // stays focused.
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      // Browser without <dialog> — fall back to setting
      // [open] (no modal backdrop, no focus trap). This is a
      // best-effort fallback; the new picker relies on <dialog>
      // for the close/re-open fix.
      dlg.setAttribute('open', '');
    }
    if (state.onOpen) {
      try { state.onOpen(state.input); } catch (_) {}
    }
  }

  function _close(state) {
    if (!state || !state._dlg || !state._isOpen) return;
    state._dlg.close(); // fires 'close' event → clears state
  }

  function _destroy(state) {
    if (!state) return;
    _close(state);
    if (state._dlg && state._dlg.parentNode) {
      try { state._dlg.parentNode.removeChild(state._dlg); } catch (_) {}
    }
    // Detach the focus / mousedown / click listeners so the input
    // reverts to its native picker behaviour after destroy().
    if (state.input && state._focusHandler) {
      try { state.input.removeEventListener('focus', state._focusHandler); } catch (_) {}
      try { state.input.removeEventListener('mousedown', state._mouseDownHandler); } catch (_) {}
      try { state.input.removeEventListener('click', state._clickHandler); } catch (_) {}
    }
    if (state.input && state.input._dpv2_id) {
      try { delete state.input._dpv2_id; } catch (_) {}
    }
    // Phase 2 visual fix — restore the original `type` attribute
    // so the input reverts to its native picker behavior after
    // destroy(). enhance() swapped the type to "text" to suppress
    // the OS-native picker; destroy() must reverse that swap so
    // the input is fully restored.
    if (state.input && state._originalType) {
      try { state.input.setAttribute('type', state._originalType); } catch (_) {}
      try { state.input.type = state._originalType; } catch (_) {}
    }
    if (states[state.id]) delete states[state.id];
  }

  // ----- by-id lookups (HT.datePickerV2.openById etc) -----

  function openById(id) {
    var s = stateById(id);
    if (s) _open(s);
    return s ? s._public : null;
  }
  function closeById(id) {
    var s = stateById(id);
    if (s) _close(s);
    return s ? s._public : null;
  }
  function destroyById(id) {
    var s = stateById(id);
    if (s) _destroy(s);
  }
  function isOpenById(id) {
    var s = stateById(id);
    return s ? s._isOpen : false;
  }

  DPV.core = Object.freeze({
    enhance: enhance,
    openById: openById,
    closeById: closeById,
    destroyById: destroyById,
    isOpenById: isOpenById,
    _open: _open,           // exposed for smoke harness
    _close: _close,
    _destroy: _destroy,
    _stateFor: stateFor,    // exposed for smoke harness
    _currentOpenInput: function () { return currentOpenInput; },
    _reset: function () {
      // Test-only: drop all state. Used by the smoke harness.
      currentOpenInput = null;
      states = Object.create(null);
      nextStateId = 1;
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);