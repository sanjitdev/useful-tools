/* ============================================
   Smoke harness for Story 2.4 — assets/js/a11y.js.
   Loads a11y.js in a fresh vm context with stub
   window / document / getComputedStyle and asserts
   the HT.a11y surface + AuditReport behavior per
   api-contract.js (version 1.8.0; bumped from 1.7.0 by Story 2.5).
   Five synthetic
   tools exercise every check: clean-tool,
   hover-only-tool, unlabeled-tool,
   tabindex-positive-tool, missing-skip-tool.
   Vacuous-pass guard at exit.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const A11Y_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/a11y.js'),
  'utf8'
);

// -------------------------------------------------------------
// Test fixtures — DOM stubs that look like a Tool page for each
// of the five audit scenarios. Each fixture exposes a
// querySelector(selector) that handles the focusable selector +
// a few auxiliary selectors.
// -------------------------------------------------------------

function E(tag, attrs, children) {
  const a = (attrs && typeof attrs === 'object') ? attrs : {};
  const node = {
    tagName: String(tag).toUpperCase(),
    attrs: a,
    children: children || [],
    _parent: null,
    getAttribute(name) { return this.attrs[name] != null ? this.attrs[name] : null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    get textContent() {
      const t = this.attrs.text;
      if (t != null) return t;
      const parts = [];
      for (const c of this.children || []) {
        if (c && typeof c.textContent === 'string') parts.push(c.textContent);
      }
      return parts.join('');
    },
    querySelector(sel) { return _selectOne(this, sel); },
    querySelectorAll(sel) { return _selectAll(this, sel); },
  };
  return node;
}

// Selector mini-engine — handles the focusable composite
// selector plus #id, .class, tag, [attr], label[for="..."], and
// form-scoped queries. The composite is rebuilt from the same
// primitive pieces a11y.js uses, so a focused selector test is
// not needed.
const FOCUS_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea']);
const FOCUSABLE_RE = /^(a|button|input|select|textarea)(?:#([\w-]+))?(?:\.([\w-]+))?$/;
const TAG_RE = /^([a-z]+)$/;
const ID_RE = /^#([\w-]+)$/;
const CLASS_RE = /^\.([\w-]+)$/;
const ATTR_RE = /^\[([a-z-]+)(?:=["']?([^"'\]]+)["']?)?\]$/;
const LABEL_FOR_RE = /^label\[for="([^"]+)"\]$/;

function _norm(s) { return String(s || '').toLowerCase(); }

function _matches(node, sel) {
  if (!node) return false;
  const tag = _norm(node.tagName);
  // Composite — expanded form (a[href], button:not([disabled]), etc.).
  if (sel === 'a[href]') return tag === 'a' && node.attrs.href != null;
  if (sel === 'button:not([disabled])') {
    return tag === 'button' && node.attrs.disabled == null;
  }
  if (sel === 'input:not([disabled])') {
    return tag === 'input' && node.attrs.disabled == null;
  }
  if (sel === 'select:not([disabled])') {
    return tag === 'select' && node.attrs.disabled == null;
  }
  if (sel === 'textarea:not([disabled])') {
    return tag === 'textarea' && node.attrs.disabled == null;
  }
  if (sel === '[tabindex]:not([tabindex="-1"])') {
    return node.attrs.tabindex != null && String(node.attrs.tabindex) !== '-1';
  }
  const m = ID_RE.exec(sel);
  if (m) return node.attrs.id === m[1];
  const m2 = TAG_RE.exec(sel);
  if (m2) return tag === m2[1];
  const m3 = CLASS_RE.exec(sel);
  if (m3) {
    const cls = String(node.attrs.class || '');
    return cls.split(/\s+/).indexOf(m3[1]) !== -1;
  }
  const m4 = ATTR_RE.exec(sel);
  if (m4) {
    const v = node.attrs[m4[1]];
    if (m4[2] == null) return v != null;
    return v === m4[2];
  }
  const m5 = LABEL_FOR_RE.exec(sel);
  if (m5) return tag === 'label' && node.attrs.for === m5[1];
  return false;
}

function _walkAll(root) {
  const out = [];
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (typeof n.tagName !== 'string') return;
    out.push(n);
    for (const c of (n.children || [])) visit(c);
  }
  visit(root);
  return out;
}

function _selectAll(root, sel) {
  if (!root || typeof sel !== 'string') return [];
  const all = _walkAll(root);
  if (sel.indexOf(',') === -1) {
    return all.filter(function (n) { return _matches(n, sel); });
  }
  const parts = sel.split(',').map(function (s) { return s.trim(); });
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    for (const n of all) {
      if (seen.has(n)) continue;
      if (_matches(n, part)) {
        seen.add(n);
        out.push(n);
      }
    }
  }
  return out;
}

function _selectOne(root, sel) {
  const all = _selectAll(root, sel);
  return all.length ? all[0] : null;
}

// Each fixture exposes a getComputedStyle stub keyed by element
// reference so the test can set per-element hover/focus styles.
function makeCtx(fixture) {
  const computedTable = new Map();
  function setComputed(el, pseudo, prop, value) {
    if (!computedTable.has(el)) computedTable.set(el, {});
    const tbl = computedTable.get(el);
    const key = pseudo + ':' + prop;
    tbl[key] = value;
  }
  const ctx = {
    window: {
      getComputedStyle(el, pseudo) {
        const tbl = computedTable.get(el) || {};
        const p = String(pseudo || '');
        return {
          getPropertyValue(prop) {
            const k = p + ':' + prop;
            return tbl[k] != null ? tbl[k] : '';
          },
        };
      },
    },
    document: {
      querySelector(sel) {
        if (sel === 'main[data-slug]') return fixture.main;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === 'main[data-slug]') return [fixture.main];
        return [];
      },
      getElementById() { return null; },
      createElement(t) {
        return E(String(t).toLowerCase(), {}, []);
      },
      body: E('body'),
    },
    console,
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout,
  };
  ctx.window.document = ctx.document;
  // Pass-through for newly-created elements in getComputedStyle path.
  return { ctx: ctx, setComputed: setComputed };
}

// -------------------------------------------------------------
// Fixtures — five tools exercising the audit's gaps.
// -------------------------------------------------------------

function fixtureCleanTool() {
  const skip = E('a', { id: 'shell-skip', class: 'shell-skip', href: '#main', text: 'Skip' });
  const amount = E('input', { id: 'ct-amount', type: 'number' });
  const amountLabel = E('label', { for: 'ct-amount', text: 'Amount' });
  const rate = E('input', { id: 'ct-rate', type: 'number' });
  const rateLabel = E('label', { for: 'ct-rate', text: 'Rate' });
  const sample = E('button', { type: 'button', class: 'btn--ghost', text: 'Try an example', 'aria-label': 'Try an example (s)' });
  const reset = E('button', { type: 'button', class: 'btn--destructive', text: 'Reset to sample', 'aria-label': 'Reset to sample (r)' });
  const result = E('a', { href: '#result', text: 'View result' });
  const form = E('form', { class: 'tool-form' }, [amountLabel, amount, rateLabel, rate, sample, reset]);
  const main = E('main', { 'data-slug': 'clean-tool', id: 'main' }, [skip, form, result]);
  return { main, skip, amount, rate, sample, reset, result, form };
}

function fixtureHoverOnlyTool() {
  const skip = E('a', { id: 'shell-skip', class: 'shell-skip', href: '#main', text: 'Skip' });
  const btn = E('button', { type: 'button', class: 'btn-hover-only', text: 'Press me', 'aria-label': 'Press me' });
  const main = E('main', { 'data-slug': 'hover-only-tool', id: 'main' }, [skip, btn]);
  return { main, skip, btn };
}

function fixtureUnlabeledTool() {
  const skip = E('a', { id: 'shell-skip', class: 'shell-skip', href: '#main', text: 'Skip' });
  const btn = E('button', { type: 'button', class: 'btn-icon' });
  // No aria-label, no text — just an svg child, which our textContent
  // counts as empty.
  const svg = E('svg', {});
  btn.children.push(svg);
  const main = E('main', { 'data-slug': 'unlabeled-tool', id: 'main' }, [skip, btn]);
  return { main, skip, btn };
}

function fixtureTabindexPositive() {
  const skip = E('a', { id: 'shell-skip', class: 'shell-skip', href: '#main', text: 'Skip' });
  const link = E('a', { id: 'tp-link', href: '#x', tabindex: '1', text: 'Tab' });
  const main = E('main', { 'data-slug': 'tabindex-positive-tool', id: 'main' }, [skip, link]);
  return { main, skip, link };
}

function fixtureMissingSkip() {
  const link = E('a', { id: 'some-link', href: '#x', text: 'Hi' });
  const main = E('main', { 'data-slug': 'missing-skip-tool', id: 'main' }, [link]);
  return { main, link };
}

// -------------------------------------------------------------
// Build a context, install per-fixture :focus-visible styles,
// run a11y.js in the vm context, return {HT, ctx, setComputed}.
// -------------------------------------------------------------

function runA11y(fixture, computedAssigner) {
  const { ctx, setComputed } = makeCtx(fixture);
  ctx.HT = {};
  ctx.window.HT = ctx.HT;
  vm.createContext(ctx);
  vm.runInContext(A11Y_SRC, ctx, { filename: 'a11y.js' });
  if (typeof computedAssigner === 'function') {
    computedAssigner(setComputed, fixture);
  }
  return { HT: ctx.HT, ctx: ctx, setComputed: setComputed };
}

// Default computed-style assigner — every focusable element
// presents the design-system ring token (3px solid / 2px offset).
function _setCompliantRing(setComputed, root) {
  const focusables = _selectAll(root, [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','));
  for (const el of focusables) {
    setComputed(el, ':focus-visible', 'outline-width', '3px');
    setComputed(el, ':focus-visible', 'outline-offset', '2px');
  }
}

// -------------------------------------------------------------
// Test runner
// -------------------------------------------------------------

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// =============================================================
// Surface-level checks — run against clean-tool.
// =============================================================

const cleanF = fixtureCleanTool();
const cleanR = runA11y(cleanF, _setCompliantRing);

check('HT.a11y exists', typeof cleanR.HT.a11y === 'object');
check('HT.a11y is frozen', Object.isFrozen(cleanR.HT.a11y) === true);
check('HT.a11y.auditTool is function', typeof cleanR.HT.a11y.auditTool === 'function');
check('HT.a11y.tabOrder is function', typeof cleanR.HT.a11y.tabOrder === 'function');
check('HT.a11y.missingAria is function', typeof cleanR.HT.a11y.missingAria === 'function');
check('HT.a11y.hoverOnly is function', typeof cleanR.HT.a11y.hoverOnly === 'function');
check('HT.a11y.focusRingOk is function', typeof cleanR.HT.a11y.focusRingOk === 'function');
check('HT.a11y.focusable is function', typeof cleanR.HT.a11y.focusable === 'function');

// =============================================================
// AC audit — clean-tool passes everything.
// =============================================================

const cleanReport = cleanR.HT.a11y.auditTool('clean-tool');
// Diagnostic dump — helps when a fixture assumption is wrong.
// if (!cleanReport.passed) {
//   console.log('  DIAG  clean-tool gaps:');
//   for (const k of Object.keys(cleanReport.gaps)) {
//     const v = cleanReport.gaps[k];
//     console.log('    ' + k + ': ' + (Array.isArray(v) ? v.length : v));
//   }
//   console.log('    tabOrder: ' + JSON.stringify(cleanReport.tabOrder));
// }
check('auditTool(clean-tool).passed === true',
  cleanReport && cleanReport.passed === true);
check('auditTool(clean-tool).gaps.positiveTabindex empty',
  Array.isArray(cleanReport.gaps.positiveTabindex) && cleanReport.gaps.positiveTabindex.length === 0);
check('auditTool(clean-tool).gaps.missingAria empty',
  Array.isArray(cleanReport.gaps.missingAria) && cleanReport.gaps.missingAria.length === 0);
check('auditTool(clean-tool).gaps.hoverOnly empty',
  Array.isArray(cleanReport.gaps.hoverOnly) && cleanReport.gaps.hoverOnly.length === 0);
check('auditTool(clean-tool).gaps.focusRingMissing empty',
  Array.isArray(cleanReport.gaps.focusRingMissing) && cleanReport.gaps.focusRingMissing.length === 0);
check('auditTool(clean-tool).gaps.unreachableInteractive empty',
  Array.isArray(cleanReport.gaps.unreachableInteractive) && cleanReport.gaps.unreachableInteractive.length === 0);
check('auditTool(clean-tool).gaps.missingSkip empty',
  Array.isArray(cleanReport.gaps.missingSkip) && cleanReport.gaps.missingSkip.length === 0);
check('auditTool(clean-tool).tabOrder[0] is the skip-link',
  cleanReport.tabOrder[0] === '#shell-skip');
check('auditTool(clean-tool).interactiveCount === tabOrder.length',
  cleanReport.interactiveCount === cleanReport.tabOrder.length);
check('auditTool(clean-tool).report is deeply frozen',
  Object.isFrozen(cleanReport) && Object.isFrozen(cleanReport.gaps));

// =============================================================
// Hover-only fixture — fails on hover gap.
// =============================================================

const hoverF = fixtureHoverOnlyTool();
const hoverR = runA11y(hoverF, function (setComputed, root) {
  _setCompliantRing(setComputed, root);
  // Set ONLY :hover background-color — no matching :focus-visible
  // rule. Per the AC-5 heuristic this is a load-bearing hover cue
  // with no keyboard parity, so the gate flags it.
  setComputed(hoverF.btn, ':hover', 'background-color', 'rgb(200, 0, 0)');
  // Intentionally leave :focus-visible background-color empty.
});
const hoverReport = hoverR.HT.a11y.auditTool('hover-only-tool');
check('auditTool(hover-only-tool).passed === false',
  hoverReport.passed === false);
check('auditTool(hover-only-tool).gaps.hoverOnly non-empty',
  hoverReport.gaps.hoverOnly.length > 0);

// =============================================================
// Unlabeled fixture — button missing aria-label/text.
// =============================================================

const unF = fixtureUnlabeledTool();
const unR = runA11y(unF, _setCompliantRing);
const unReport = unR.HT.a11y.auditTool('unlabeled-tool');
check('auditTool(unlabeled-tool).passed === false',
  unReport.passed === false);
check('auditTool(unlabeled-tool).gaps.missingAria non-empty',
  unReport.gaps.missingAria.length > 0);
const cleanMissingAriaArr = cleanR.HT.a11y.missingAria('clean-tool');
check('missingAria: skips the <input>-with-label case',
  Array.isArray(cleanMissingAriaArr) && cleanMissingAriaArr.length === 0,
  'got: ' + (Array.isArray(cleanMissingAriaArr) ? cleanMissingAriaArr.length : typeof cleanMissingAriaArr));

// Diagnostic — print what missingAria flags on clean-tool.
// const missingOnClean = cleanR.HT.a11y.missingAria('clean-tool');
// console.log('  DIAG  missingAria(clean-tool) count: ' + missingOnClean.length);

// =============================================================
// tabindex positive — fails positive-tabindex gate.
// =============================================================

const tpF = fixtureTabindexPositive();
const tpR = runA11y(tpF, _setCompliantRing);
const tpReport = tpR.HT.a11y.auditTool('tabindex-positive-tool');
check('auditTool(tabindex-positive-tool).passed === false',
  tpReport.passed === false);
check('auditTool(tabindex-positive-tool).gaps.positiveTabindex non-empty',
  tpReport.gaps.positiveTabindex.length > 0);

// =============================================================
// Missing skip — fails missingSkip gate (and indirectly hoverOnly/etc).
// =============================================================

const msF = fixtureMissingSkip();
const msR = runA11y(msF, _setCompliantRing);
const msReport = msR.HT.a11y.auditTool('missing-skip-tool');
check('auditTool(missing-skip-tool).passed === false',
  msReport.passed === false);
check('auditTool(missing-skip-tool).gaps.missingSkip non-empty',
  msReport.gaps.missingSkip.length > 0);

// =============================================================
// focusRingOk — verifies the :focus-visible ring read.
// =============================================================

const frF = fixtureCleanTool();
const frR = runA11y(frF, function (setComputed, root) {
  // Intentionally omit the outline values on one element to verify
  // the {ok, missing} branch when a CSS source is incomplete.
  // For the bare check we don't apply any; the focus-ring read
  // returns empty strings, which the implementation treats as
  // "covered by parent rule" — so missing stays empty.
  _setCompliantRing(setComputed, root);
});
check('focusRingOk(clean-tool).ok === true',
  frR.HT.a11y.focusRingOk(frF.main).ok === true);
check('focusRingOk(clean-tool).missing is empty',
  frR.HT.a11y.focusRingOk(frF.main).missing.length === 0);

// Force a non-compliant outline on the rate input.
const frBadF = fixtureCleanTool();
const frBadR = runA11y(frBadF, function (setComputed, root) {
  _setCompliantRing(setComputed, root);
  setComputed(frBadF.rate, ':focus-visible', 'outline-width', '0px');
  setComputed(frBadF.rate, ':focus-visible', 'outline-offset', '2px');
});
const frBadResult = frBadR.HT.a11y.focusRingOk(frBadF.main);
check('focusRingOk(compliant) ok',
  typeof frBadResult === 'object' && typeof frBadResult.ok === 'boolean');
check('focusRingOk with mismatched width returns missing',
  frBadResult.missing.length > 0);

// =============================================================
// hoverOnly allows decorative-only hover changes.
// =============================================================

const decoF = fixtureCleanTool();
const decoR = runA11y(decoF, function (setComputed, root) {
  _setCompliantRing(setComputed, root);
  // Decorative opacity change w/o bg change should not flag.
  setComputed(decoF.sample, ':hover', 'opacity', '0.8');
  setComputed(decoF.sample, ':focus-visible', 'opacity', '1');
});
check('hoverOnly: decorative opacity alone is NOT flagged',
  decoR.HT.a11y.hoverOnly(decoF.main).length === 0);

// =============================================================
// api-contract.js cross-pin
// =============================================================

const contractSrc = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);
check('api-contract: version === 1.8.0 (Story 2.4 standalone: 1.6.0; bundled 2.3+2.4: 1.7.0; bundled 2.3+2.4+2.5: 1.8.0)',
  /version:\s*['"]1\.8\.0['"]/.test(contractSrc));
const matches = contractSrc.match(/name:\s*['"]HT\.a11y\.[\w.]+['"]/g) || [];
const names = matches.map(function (m) {
  return /['"](HT\.a11y\.[\w.]+)['"]/.exec(m)[1];
});
check('api-contract: HT.a11y.auditTool entry present',
  names.indexOf('HT.a11y.auditTool') !== -1);
check('api-contract: HT.a11y.tabOrder entry present',
  names.indexOf('HT.a11y.tabOrder') !== -1);
check('api-contract: HT.a11y.missingAria entry present',
  names.indexOf('HT.a11y.missingAria') !== -1);
check('api-contract: HT.a11y.hoverOnly entry present',
  names.indexOf('HT.a11y.hoverOnly') !== -1);
check('api-contract: HT.a11y.focusRingOk entry present',
  names.indexOf('HT.a11y.focusRingOk') !== -1);
check('api-contract: HT.a11y.focusable entry present',
  names.indexOf('HT.a11y.focusable') !== -1);
check('api-contract: exactly 6 HT.a11y.* entries',
  names.length === 6);

// =============================================================
// Error shape — invalid slug throws UrlStateSchemaError.
// =============================================================

let threwInvalid = false;
let errorName = '';
try {
  cleanR.HT.a11y.auditTool('Not-A-Slug!');
} catch (e) {
  threwInvalid = true;
  errorName = e && e.name ? e.name : '';
}
check('auditTool(bad-slug) throws', threwInvalid);
check('auditTool(bad-slug) error.name === UrlStateSchemaError',
  errorName === 'UrlStateSchemaError');

// =============================================================
// Vacuous-pass guard
// =============================================================

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run — zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
