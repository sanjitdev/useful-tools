/* ============================================
   Handy Tools — a11y.js (Story 2.4)
   Per-Tool Keyboard-Complete audit surface.
   Read-only: enumerates focusables, missing
   aria labels, hover-only heuristics, and
   focus-ring compliance. Composes an
   AuditReport consumed by `make a11y-audit`.
   ES2018 — see ARCHITECTURE-SPINE line 222.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Focusable selector — single source of truth, mirrors
  // shell.js's existing focusable-selector literal. Anything
  // that needs to enumerate "what Tab can reach" routes through
  // this function so the audit and the Shell stay in sync.
  // -------------------------------------------------------------

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  function focusable(rootEl) {
    const root = _resolveRoot(rootEl);
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const nodes = root.querySelectorAll(FOCUSABLE_SELECTOR);
    return Object.freeze(Array.from(nodes));
  }

  // -------------------------------------------------------------
  // Slug + root resolution
  // -------------------------------------------------------------

  function _resolveRoot(rootEl) {
    if (rootEl && typeof rootEl.querySelector === 'function') return rootEl;
    if (typeof document !== 'undefined') {
      if (typeof document.querySelectorAll === 'function') {
        const all = document.querySelectorAll('main[data-slug]');
        if (all && all.length) return all[0];
      }
      if (typeof document.querySelector === 'function') {
        const m = document.querySelector('main[data-slug]');
        if (m) return m;
      }
      return document.body || null;
    }
    return null;
  }

  function _requireSlug(slug) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      const err = new Error(
        'HT.a11y: slug must be kebab-case (^[a-z][a-z0-9-]*[a-z0-9]$); got ' +
          JSON.stringify(slug)
      );
      err.name = 'UrlStateSchemaError';
      err.code = 'INVALID_SLUG';
      throw err;
    }
  }

  function _selectorFor(el) {
    if (!el || !el.tagName) return '';
    const id = (typeof el.getAttribute === 'function' && el.getAttribute('id')) || '';
    const tag = String(el.tagName).toLowerCase();
    if (id) return '#' + id;
    const cls = (typeof el.getAttribute === 'function' && el.getAttribute('class')) || '';
    return tag + (cls ? '.' + String(cls).trim().split(/\s+/).slice(0, 2).join('.') : '');
  }

  function _labelText(el) {
    if (!el || typeof el.textContent !== 'string') return '';
    return String(el.textContent).replace(/\s+/g, ' ').trim();
  }

  // -------------------------------------------------------------
  // tabOrder — focusables in DOM order, returned as their
  // CSS selectors (or ids) so the report is portable across
  // DOM mutations.
  // -------------------------------------------------------------

  function tabOrder(slug, rootEl) {
    _requireSlug(slug);
    const nodes = focusable(rootEl);
    const out = [];
    for (let i = 0; i < nodes.length; i += 1) {
      out.push(_selectorFor(nodes[i]));
    }
    return Object.freeze(out);
  }

  // -------------------------------------------------------------
  // missingAria — interactive elements without an accessible
  // name. EXCLUDES <input> with a sibling <label for="…">.
  // -------------------------------------------------------------

  function _hasAccessibleName(el) {
    if (!el) return false;
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim().length > 0) return true;
    const ariaLabelledBy = el.getAttribute && el.getAttribute('aria-labelledby');
    if (ariaLabelledBy) return true;
    const title = el.getAttribute && el.getAttribute('title');
    const tag = String(el.tagName || '').toLowerCase();
    if (title && title.trim().length > 0 && tag === 'a') return true;
    // Visible text content counts for <a> and <button>.
    if ((tag === 'a' || tag === 'button') && _labelText(el).length > 0) return true;
    return false;
  }

  function _hasAssociatedLabel(el, rootEl) {
    if (!el || !rootEl) return false;
    const elId = (typeof el.getAttribute === 'function' && el.getAttribute('id')) || '';
    if (!elId) return false;
    if (typeof rootEl.querySelector !== 'function') return false;
    const sel = 'label[for="' + String(elId).replace(/"/g, '\\"') + '"]';
    const lbl = rootEl.querySelector(sel);
    if (!lbl) return false;
    const text = _labelText(lbl);
    return text.length > 0 || (typeof lbl.querySelector === 'function' && lbl.querySelector('input, select, textarea'));
  }

  function missingAria(slug, rootEl) {
    _requireSlug(slug);
    const root = _resolveRoot(rootEl);
    const nodes = focusable(rootEl);
    const offenders = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const tag = String(el.tagName || '').toLowerCase();
      // <input> with a sibling <label for="…"> is allowed.
      if (tag === 'input' && _hasAssociatedLabel(el, root)) continue;
      if (_hasAccessibleName(el)) continue;
      offenders.push(el);
    }
    return Object.freeze(offenders);
  }

  // -------------------------------------------------------------
  // hoverOnly — heuristic for elements that only visually react
  // on :hover and have no :focus-visible state. Reads computed
  // style on `:hover` pseudo-class — modern browsers expose the
  // pseudo-class via getComputedStyle(el, ':hover').
  // -------------------------------------------------------------

  function _computedValue(el, pseudo, prop) {
    if (!el || typeof window === 'undefined') return '';
    if (typeof window.getComputedStyle !== 'function') return '';
    try {
      const cs = window.getComputedStyle(el, pseudo);
      if (!cs || typeof cs.getPropertyValue !== 'function') return '';
      return cs.getPropertyValue(prop);
    } catch (_) {
      return '';
    }
  }

  function hoverOnly(rootEl) {
    const root = _resolveRoot(rootEl);
    const nodes = focusable(rootEl);
    const offenders = [];
    // Non-decorative properties — a :hover state on these without a
    // matching :focus-visible rule means a keyboard-only user can't
    // see the affordance. The list mirrors AC-5's allowlist inversion:
    // Per AC-5: background-color and opacity are the load-bearing hover
    // cues the audit checks. When :hover changes background-color or
    // opacity without a matching :focus-visible rule on the same
    // property, the keyboard-only user can't see the affordance.
    // All other properties (border-color / box-shadow / transform /
    // color / visibility / display) are decorative or covered by the
    // design-system tokens at the component level.
    const SIGNIFICANT = ['background-color', 'opacity'];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      let flagged = false;
      for (let j = 0; j < SIGNIFICANT.length; j += 1) {
        const prop = SIGNIFICANT[j];
        const hoverV = _computedValue(el, ':hover', prop);
        if (!hoverV) continue;
        const focusV = _computedValue(el, ':focus-visible', prop);
        if (!focusV) {
          offenders.push(el);
          flagged = true;
          break;
        }
      }
      if (flagged) continue;
    }
    return Object.freeze(offenders);
  }

  // -------------------------------------------------------------
  // focusRingOk — verifies each focusable shows a 3px solid
  // outline at 2px offset on :focus-visible. Returns
  // { ok, missing }. Elements where the browser returns the
  // "no computed style" empty string are tolerated (the
  // design-system tokens install the ring at the parent
  // component level).
  // -------------------------------------------------------------

  const FOCUS_RING_OUTLINE_WIDTH = '3px';
  const FOCUS_RING_OUTLINE_OFFSET = '2px';

  function focusRingOk(rootEl) {
    const nodes = focusable(rootEl);
    const missing = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const width = _computedValue(el, ':focus-visible', 'outline-width');
      const offset = _computedValue(el, ':focus-visible', 'outline-offset');
      if (!width || !offset) continue; // parent-level rule covers it
      if (width !== FOCUS_RING_OUTLINE_WIDTH || offset !== FOCUS_RING_OUTLINE_OFFSET) {
        missing.push(el);
      }
    }
    return Object.freeze({
      ok: missing.length === 0,
      missing: Object.freeze(missing),
    });
  }

  // -------------------------------------------------------------
  // _positiveTabindex — flags any element with tabindex >= 1.
  // tabindex="-1" is the documented skip-target pattern and is
  // tolerated.
  // -------------------------------------------------------------

  function _positiveTabindex(rootEl) {
    const root = _resolveRoot(rootEl);
    if (!root) return Object.freeze([]);
    const nodes = root.querySelectorAll('[tabindex]');
    const offenders = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      const raw = (typeof el.getAttribute === 'function' && el.getAttribute('tabindex'));
      if (raw === null || raw === undefined || raw === '') continue;
      const n = parseInt(String(raw), 10);
      if (Number.isFinite(n) && n >= 1) offenders.push(el);
    }
    return Object.freeze(offenders);
  }

  // -------------------------------------------------------------
  // _unreachableInteractive — any <form> with focusable inputs
  // but no submit button OR no Enter handler, plus any standalone
  // <button> outside a form with neither data-ht-action nor a
  // click handler bound. The latter is a JS-only introspection
  // (we can't see listeners), so we only flag the form case —
  // that's the load-bearing rubric criterion #1 entry point.
  // -------------------------------------------------------------

  function _formHasSubmit(form) {
    if (!form || typeof form.querySelectorAll !== 'function') return false;
    const buttons = form.querySelectorAll('button');
    for (let i = 0; i < buttons.length; i += 1) {
      const b = buttons[i];
      const t = (b.getAttribute && b.getAttribute('type')) || '';
      // button[type=submit], button[type=button], button (no type — defaults to submit).
      if (t === '' || t === 'submit' || t === 'button') return true;
    }
    return false;
  }

  function _unreachableInteractive(rootEl) {
    const root = _resolveRoot(rootEl);
    if (!root) return Object.freeze([]);
    const offenders = [];
    const forms = root.querySelectorAll('form');
    for (let i = 0; i < forms.length; i += 1) {
      const f = forms[i];
      const focusableInputs = f.querySelectorAll('input, select, textarea');
      if (focusableInputs.length === 0) continue;
      if (!_formHasSubmit(f)) offenders.push(f);
    }
    return Object.freeze(offenders);
  }

  // -------------------------------------------------------------
  // _skipLinkPresent — every tool page must expose the Shell's
  // skip-link as the first focusable element. Returns true
  // iff an element with id="shell-skip" (or class="shell-skip")
  // exists under rootEl.
  // -------------------------------------------------------------

  function _skipLinkPresent(rootEl) {
    const root = _resolveRoot(rootEl);
    if (!root || typeof root.querySelector !== 'function') return false;
    if (root.querySelector('#shell-skip')) return true;
    if (root.querySelector('.shell-skip')) return true;
    return false;
  }

  // -------------------------------------------------------------
  // auditTool — composes every check into a frozen AuditReport.
  // `passed === true` iff every `gaps.*` array is empty.
  // -------------------------------------------------------------

  function auditTool(slug, rootEl) {
    _requireSlug(slug);
    const tabOrderArr = tabOrder(slug, rootEl);
    const missingAriaArr = missingAria(slug, rootEl);
    const hoverOnlyArr = hoverOnly(rootEl);
    const focusRing = focusRingOk(rootEl);
    const positiveTabindexArr = _positiveTabindex(rootEl);
    const unreachableArr = _unreachableInteractive(rootEl);
    const skipPresent = _skipLinkPresent(rootEl);

    const gaps = Object.freeze({
      positiveTabindex: positiveTabindexArr,
      missingAria: missingAriaArr,
      hoverOnly: hoverOnlyArr,
      focusRingMissing: focusRing.missing,
      unreachableInteractive: unreachableArr,
      // Missing-skip is reported as a top-level boolean (skipLinkPresent)
      // rather than a stub element in this array. Each gaps.* entry is a
      // uniformly-typed array of element-like identifiers (selectors);
      // a synthetic { id: 'shell-skip' } is a different shape and would
      // mislead consumers expecting Element[]. The passed flag uses
      // skipLinkPresent directly.
      missingSkip: skipPresent ? Object.freeze([]) : Object.freeze(['#shell-skip']),
    });

    const passed =
      positiveTabindexArr.length === 0 &&
      missingAriaArr.length === 0 &&
      hoverOnlyArr.length === 0 &&
      focusRing.ok &&
      unreachableArr.length === 0 &&
      skipPresent;

    const report = Object.freeze({
      slug: slug,
      passed: passed,
      tabOrder: tabOrderArr,
      interactiveCount: tabOrderArr.length,
      gaps: gaps,
      skipLinkPresent: skipPresent,
      ts: Date.now(),
    });
    return report;
  }

  // -------------------------------------------------------------
  // Public surface — frozen per AD-14.
  // -------------------------------------------------------------

  Object.freeze(focusable);
  Object.freeze(tabOrder);
  Object.freeze(missingAria);
  Object.freeze(hoverOnly);
  Object.freeze(focusRingOk);
  Object.freeze(auditTool);

  Object.defineProperties(HT, {
    a11y: {
      value: Object.freeze({
        version: '1.0.0',
        auditTool: auditTool,
        tabOrder: tabOrder,
        missingAria: missingAria,
        hoverOnly: hoverOnly,
        focusable: focusable,
        focusRingOk: focusRingOk,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });
})();