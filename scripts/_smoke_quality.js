/* ============================================
   Smoke harness for Story 2.11 — /quality page.

   Verifies:
     1. Static checks on quality.html:
        - file exists at repo root
        - chrome footer href="/quality" is present
        - <main aria-label="Quality scorecard"> landmark
        - <table id="ht-quality-table"> present with 5 base <th> cells
          (the 10 criterion columns are appended by assets/js/quality.js
          at runtime — AC-7 forbids them in static HTML)
        - 0 <tr> rows carry data-ht-tool in the static HTML
        - <script src="assets/js/quality.js" defer> is the LAST shell
          script tag in the page
        - <noscript> notice is present

     2. Behavioral checks via vm + synthetic DOM:
        - quality.js loads without throwing
        - with stubbed fetch returning 2 tools + a synthetic rubric doc,
          the table renders 2 <tr data-ht-tool> rows
        - each row has 15 <td> cells (5 meta + 10 criterion)
        - clicking a criterion cell inserts a <tr class="ht-quality-remediation-row">
        - rubric summary section renders 10 <details> accordions
        - the public HT.quality surface is frozen
        - HT.quality.data exposes the fetched payload

   Exit codes: 0 = all green, 1 = any failure, 2 = vacuous pass.

   Mirrors the shape of _smoke_shell_public_api.js (vm context, stub
   document) plus the static-HT checks from _smoke_wave_*.js.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const QUALITY_HTML = path.join(REPO, 'quality.html');
const QUALITY_JS = path.join(REPO, 'assets', 'js', 'quality.js');

let pass = 0;
let fail = 0;

function check(name, ok, info) {
  if (ok) {
    console.log('  PASS  ' + name);
    pass += 1;
  } else {
    console.log('  FAIL  ' + name + (info ? ' — ' + info : ''));
    fail += 1;
  }
}

// ---------- 1. Static checks ----------

let html = null;
try {
  html = fs.readFileSync(QUALITY_HTML, 'utf8');
} catch (e) {
  console.error('  FAIL  read quality.html — ' + e.message);
  process.exit(1);
}

check('quality.html exists', fs.existsSync(QUALITY_HTML));
check('chrome footer href="/quality" present', /href="\/quality"/.test(html));
check('<main aria-label="Quality scorecard"> present', /aria-label="Quality scorecard"/.test(html));
check('<table id="ht-quality-table"> present', /id="ht-quality-table"/.test(html));

// Count base <th> cells (must be exactly 5 — Tool/Slug/Score/Audit/Bar).
// The 10 criterion columns are appended by JS at runtime; static HTML
// must NOT include them (AC-7). Strip HTML comments first so the regex
// doesn't false-match on the comment text that documents the 5-column rule.
const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
const theadMatch = htmlNoComments.match(/<tr\s+id="ht-quality-thead-row">([\s\S]*?)<\/tr>/);
let baseThCount = 0;
if (theadMatch) {
  // Match <th ...> opening tags (non-greedy on attributes), excluding <th>.
  const openTagRe = /<th\s+[^>]*>/g;
  baseThCount = (theadMatch[1].match(openTagRe) || []).length;
}
check('thead row has exactly 5 base <th> cells', baseThCount === 5, 'got ' + baseThCount);

const tbodyMatch = htmlNoComments.match(/<tbody\s+id="ht-quality-tbody">([\s\S]*?)<\/tbody>/);
let inlineToolRows = 0;
if (tbodyMatch) {
  inlineToolRows = (tbodyMatch[1].match(/data-ht-tool=/g) || []).length;
}
check('0 <tr data-ht-tool> rows in static HTML (AC-7)', inlineToolRows === 0, 'got ' + inlineToolRows);

check('<noscript> fallback notice present', /<noscript>/.test(html));
check('<title>Quality scorecard · Handy Tools</title> set', /<title>Quality scorecard · Handy Tools<\/title>/.test(html));

// Last-script assertion — quality.js must be the final <script> in the body.
// Use htmlNoComments so a comment block listing the script chain (which
// contains the literal `<script src="assets/js/quality.js"></script>`)
// doesn't falsely satisfy this check.
const scriptTags = htmlNoComments.match(/<script\s+[^>]*src=["']assets\/js\/[^"']+["'][^>]*>\s*<\/script>/g) || [];
const lastScript = scriptTags[scriptTags.length - 1] || '';
check('assets/js/quality.js is the LAST shell script tag',
  /src=["']assets\/js\/quality\.js["']/.test(lastScript),
  'last script: ' + lastScript.slice(0, 120));

// Quality.js must use defer (it depends on prior shell libs).
const qualityScriptTag = (html.match(/<script\s+[^>]*src=["']assets\/js\/quality\.js["'][^>]*>\s*<\/script>/) || [''])[0];
check('quality.js script tag uses defer', /\bdefer\b/.test(qualityScriptTag));

// ---------- 2. Behavioral checks via vm + synthetic DOM ----------

const qualityJs = fs.readFileSync(QUALITY_JS, 'utf8');

// Synthetic 2-tool tools.json + rubric doc. The rubric stub has all 10
// criteria with verbatim Remediation quotes so the parser's regex path
// is exercised end-to-end.
const FAKE_TOOLS = {
  $schema: 'https://example.invalid/tools.schema.json',
  schemaVersion: 1,
  releaseVersion: '9.9.9-test',
  generated: '2026-08-11T12:00:00Z',
  tools: [
    {
      slug: 'alpha-tool',
      title: 'Alpha Tool',
      'last-updated': '2026-08-01T00:00:00Z',
      ready: true,
      score: 9,
      category: 'Test',
    },
    {
      slug: 'beta-tool',
      title: 'Beta Tool',
      'last-updated': '2026-07-15T00:00:00Z',
      ready: false,
      score: 6,
      category: 'Test',
      'score-waiver': {
        reason: 'test',
        'since-release': '9.9.0',
        reviewer: 'tester',
        'expires-after-releases': 2,
      },
    },
  ],
};

const FAKE_RUBRIC = [
  '# Handy Tools — Quality Rubric (test fixture)',
  '',
  '## The Ten Criteria',
  '',
  '### 1. Keyboard-complete',
  '',
  'All inputs are reachable via Tab.',
  '',
  '| Signal | What to check |',
  '|---|---|',
  '| Remediation | "No keyboard listener detected; add a keydown listener." |',
  '',
  '### 2. Mobile ergonomics',
  '',
  'Single-hand usable on a 360 px viewport.',
  '',
  '| Signal | What to check |',
  '|---|---|',
  '| Remediation | "Raise tap-target padding so min(W,H) >= 44 px." |',
  '',
  '### 3. Offline ready',
  '',
  'No external scripts.',
  '',
  '| Remediation | "Vendor external scripts under assets/js/vendor/." |',
  '',
  '### 4. Shareable state',
  '',
  'Inputs encoded in URL.',
  '',
  '| Remediation | "Declare each input under encode[]/decode[]." |',
  '',
  '### 5. Printable',
  '',
  'Clean print stylesheet.',
  '',
  '| Remediation | "Add a @media print block that hides chrome." |',
  '',
  '### 6. Sample data',
  '',
  'Try-an-example button.',
  '',
  '| Remediation | "Add a control labeled Try an example." |',
  '',
  '### 7. History',
  '',
  'Last 10 runs persisted.',
  '',
  '| Remediation | "Declare history-keys in tools.json." |',
  '',
  '### 8. Error recovery',
  '',
  'Inline validation messages.',
  '',
  '| Remediation | "Mark inputs with role=alert + aria-invalid." |',
  '',
  '### 9. Accessible',
  '',
  'WCAG 2.1 AA.',
  '',
  '| Remediation | "Run WCAG checklist in quality-rubric.md." |',
  '',
  '### 10. Source visible',
  '',
  'View source link.',
  '',
  '| Remediation | "Add a footer link View source." |',
  '',
].join('\n');

// Build a minimal DOM stub. Elements track their tagName + a children
// array + attribute store. querySelector / getElementById match against
// the id index. insertBefore / removeChild update parent links.
function makeElement(tag) {
  const el = {
    // nodeType 1 === ELEMENT_NODE in the DOM spec. quality.js's
    // findRowForCell walks up looking for `node.nodeType === 1` —
    // without this the lookup sees undefined and never matches.
    nodeType: 1,
    tagName: tag.toUpperCase(),
    children: [],
    childNodes: [],
    parentNode: null,
    _attrs: {},
    _text: '',
    _className: '',
    style: {},
    classList: {
      _set: new Set(),
      add: function () {
        for (let i = 0; i < arguments.length; i += 1) this._set.add(arguments[i]);
      },
      remove: function () {
        for (let i = 0; i < arguments.length; i += 1) this._set.delete(arguments[i]);
      },
      contains: function (c) { return this._set.has(c); },
      toggle: function (c) {
        if (this._set.has(c)) { this._set.delete(c); return false; }
        this._set.add(c);
        return true;
      },
    },
    tabIndex: -1,
    setAttribute: function (k, v) { this._attrs[k] = String(v); },
    getAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
    },
    removeAttribute: function (k) {
      if (Object.prototype.hasOwnProperty.call(this._attrs, k)) {
        delete this._attrs[k];
      }
    },
    hasAttribute: function (k) {
      return Object.prototype.hasOwnProperty.call(this._attrs, k);
    },
    appendChild: function (child) {
      this.children.push(child);
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore: function (child, ref) {
      const idx = ref ? this.children.indexOf(ref) : -1;
      if (idx === -1) {
        this.children.push(child);
        this.childNodes.push(child);
      } else {
        this.children.splice(idx, 0, child);
        this.childNodes.splice(idx, 0, child);
      }
      child.parentNode = this;
      return child;
    },
    removeChild: function (child) {
      const i = this.children.indexOf(child);
      if (i !== -1) this.children.splice(i, 1);
      const j = this.childNodes.indexOf(child);
      if (j !== -1) this.childNodes.splice(j, 1);
      child.parentNode = null;
      return child;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function (name, fn) {
      // Capture so the smoke can dispatch a real click event through
      // the listener that attachCellHandlers registered. The makeElement
      // factory routes addEventListener calls here.
      captureListener(this, name, fn);
    },
    removeEventListener: function () { /* no-op */ },
  };
  Object.defineProperty(el, 'textContent', {
    get: function () {
      if (this.children.length === 0) return this._text;
      return this.children.map(function (c) {
        return c && c.textContent != null ? c.textContent : '';
      }).join('');
    },
    set: function (v) {
      this._text = String(v);
      // Drop children — assigning textContent replaces them.
      this.children.length = 0;
      this.childNodes.length = 0;
    },
  });
  Object.defineProperty(el, 'innerHTML', {
    get: function () { return this._text; },
    set: function (v) { this._text = String(v); this.children.length = 0; this.childNodes.length = 0; },
  });
  // className is the canonical source for the element's class list. The
  // smoke's own assertions read `classList._set` to detect class membership,
  // so the setter has to keep classList in sync — otherwise setting
  // `el.className = 'foo bar'` from inside quality.js leaves classList empty
  // and the test filter misses the element.
  Object.defineProperty(el, 'className', {
    get: function () { return this._className; },
    set: function (v) {
      this._className = String(v == null ? '' : v);
      this.classList._set.clear();
      if (this._className) {
        const parts = this._className.split(/\s+/);
        for (let i = 0; i < parts.length; i += 1) {
          if (parts[i]) this.classList._set.add(parts[i]);
        }
      }
    },
  });
  // Sibling navigation — quality.js's click handler reads nextElementSibling
  // + nextSibling to decide between toggle/replace/insert paths. The real
  // browser derives these from the parent's children array, so we mirror
  // that here.
  Object.defineProperty(el, 'nextElementSibling', {
    get: function () {
      const p = this.parentNode;
      if (!p || !p.children) return null;
      const i = p.children.indexOf(this);
      return i >= 0 && i + 1 < p.children.length ? p.children[i + 1] : null;
    },
  });
  Object.defineProperty(el, 'nextSibling', {
    get: function () {
      const p = this.parentNode;
      if (!p || !p.childNodes) return null;
      const i = p.childNodes.indexOf(this);
      return i >= 0 && i + 1 < p.childNodes.length ? p.childNodes[i + 1] : null;
    },
  });
  return el;
}

// Index the synthetic DOM so querySelector / getElementById resolve.
const elementsById = Object.create(null);
// Capture registered listeners so we can DISPATCH them in the smoke
// (otherwise addEventListener is a no-op and the real click handler is
// never exercised — see AC-8 remediation-toggle verification gap).
const registeredListeners = Object.create(null);
function registerById(id, el) {
  if (id) elementsById[id] = el;
}
function captureListener(target, name, fn) {
  if (!target || typeof fn !== 'function') return;
  const key = target._captureKey || (target._captureKey = Symbol('cap'));
  const bucket = registeredListeners[key] = registeredListeners[key] || {};
  (bucket[name] = bucket[name] || []).push(fn);
}
function dispatchOn(target, name, eventObj) {
  const key = target && target._captureKey;
  if (!key) return;
  const bucket = registeredListeners[key];
  if (!bucket || !bucket[name]) return;
  for (let i = 0; i < bucket[name].length; i += 1) {
    bucket[name][i].call(target, eventObj);
  }
}

// Build the structural skeleton matching quality.html.
const theadRow = makeElement('tr');
registerById('ht-quality-thead-row', theadRow);
['ht-quality-col-tool', 'ht-quality-col-slug', 'ht-quality-col-score', 'ht-quality-col-audit', 'ht-quality-col-bar']
  .forEach(function (id) {
    const th = makeElement('th');
    th.id = id;
    theadRow.appendChild(th);
    registerById(id, th);
  });

const tbody = makeElement('tbody');
registerById('ht-quality-tbody', tbody);

const thead = makeElement('thead');
thead.appendChild(theadRow);

const table = makeElement('table');
table.id = 'ht-quality-table';
table.appendChild(thead);
table.appendChild(tbody);
registerById('ht-quality-table', table);
table.querySelector = function () { return null; };
table.querySelectorAll = function () { return []; };

const rubricList = makeElement('div');
rubricList.id = 'ht-quality-rubric-list';
registerById('ht-quality-rubric-list', rubricList);

const meta = makeElement('p');
meta.id = 'ht-quality-meta';
registerById('ht-quality-meta', meta);

const errorHost = makeElement('div');
errorHost.id = 'ht-quality-table-error';
errorHost.setAttribute('hidden', '');
registerById('ht-quality-table-error', errorHost);

// Custom getElementById for our registry.
const stubDocument = {
  readyState: 'complete',
  documentElement: makeElement('html'),
  addEventListener: function (name, fn) {
    if (name === 'DOMContentLoaded' && typeof fn === 'function') {
      // Capture so we can dispatch manually after the script boots.
      stubDocument._domContentLoaded = fn;
    }
    captureListener(stubDocument, name, fn);
  },
  removeEventListener: function () { /* no-op */ },
  getElementById: function (id) {
    return Object.prototype.hasOwnProperty.call(elementsById, id) ? elementsById[id] : null;
  },
  querySelector: function (sel) {
    // The script uses HT.qs('css', '#id') patterns after our patch. Honor
    // the '#id' case explicitly; everything else returns null.
    if (typeof sel === 'string' && sel[0] === '#') {
      return Object.prototype.hasOwnProperty.call(elementsById, sel.slice(1))
        ? elementsById[sel.slice(1)] : null;
    }
    return null;
  },
  querySelectorAll: function () { return []; },
  createElement: function (tag) { return makeElement(tag); },
  createTextNode: function (text) {
    // Lightweight text node — bypasses makeElement so the parent-child
    // machinery (which defines textContent via defineProperty) doesn't
    // reject our redefinition. The script only ever reads .textContent
    // off the returned node, and parentNode is set by appendChild.
    const node = {
      nodeType: 3,
      _text: String(text == null ? '' : text),
      parentNode: null,
      get textContent() { return this._text; },
      set textContent(v) { this._text = String(v); },
    };
    return node;
  },
};

// Stub fetch — discriminate on URL.
const stubFetch = function (url) {
  let body;
  let contentType = 'text/plain';
  if (typeof url === 'string' && url.indexOf('tools.json') !== -1) {
    body = JSON.stringify(FAKE_TOOLS);
    contentType = 'application/json';
  } else {
    body = FAKE_RUBRIC;
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: function (k) { return k.toLowerCase() === 'content-type' ? contentType : null; } },
    json: function () { return Promise.resolve(JSON.parse(body)); },
    text: function () { return Promise.resolve(body); },
  });
};

// HT.fetch is a thin helper on top of native fetch — it returns the
// parsed body (string or JSON) directly, not a Response object. Mirror
// the production helper from assets/js/utils.js here so the script's
// fetchJson/fetchText wrappers resolve to a string/JSON, not the raw
// Response.
const stubHtFetch = function (url, opts) {
  const type = (opts && opts.type) || 'json';
  return stubFetch(url).then(function (response) {
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' for ' + url);
    }
    return type === 'text' ? response.text() : response.json();
  });
};

// Sandbox: simulate the browser globals quality.js reads.
const stubHt = {
  qs: (sel, root) => {
    if (typeof sel === 'string' && sel[0] === '#') {
      return Object.prototype.hasOwnProperty.call(elementsById, sel.slice(1))
        ? elementsById[sel.slice(1)] : null;
    }
    return null;
  },
  qsa: function (sel, root) {
    // The script only calls HT.qsa('.ht-quality-remediation-cell', tbody)
    // after our patch. Walk tbody -> tr -> td for matching class.
    if (sel === '.ht-quality-remediation-cell' && root && root.children) {
      const out = [];
      for (let i = 0; i < root.children.length; i += 1) {
        const row = root.children[i];
        if (row.tagName !== 'TR' || !row.children) continue;
        for (let j = 0; j < row.children.length; j += 1) {
          const cell = row.children[j];
          if (cell.tagName === 'TD' && cell.getAttribute && cell.getAttribute('data-ht-action') === 'expand-remediation') {
            out.push(cell);
          }
        }
      }
      return out;
    }
    return [];
  },
  fetch: stubHtFetch,
};
const stubWindow = { HT: stubHt };
const ctx = {
  window: stubWindow,
  document: stubDocument,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  fetch: stubFetch,
  URLSearchParams: URLSearchParams,
  HT: stubHt,
};

vm.createContext(ctx);
let scriptThrew = null;
try {
  vm.runInContext(qualityJs, ctx, { filename: 'quality.js' });
} catch (e) {
  scriptThrew = e;
}
check('quality.js loads in vm without throwing', !scriptThrew, scriptThrew && scriptThrew.message);

// Now dispatch the captured DOMContentLoaded listener.
let renderPromise = null;
if (stubDocument._domContentLoaded) {
  renderPromise = stubDocument._domContentLoaded();
}
if (renderPromise && typeof renderPromise.then === 'function') {
  // Drive the promise chain synchronously.
  return Promise.resolve(renderPromise)
    .then(function () { return null; })
    .catch(function () { return null; })
    .then(function () { runAssertions(); });
} else {
  // Even without a return value, render() kicked off async work; give it a
  // microtask cycle. We can't await in a sync context, so schedule via
  // setImmediate-equivalent.
  setImmediate(function () { runAssertions(); });
}

function runAssertions() {
  // After render: thead row should now have 5 + 10 = 15 <th> children.
  const ths = theadRow.children.filter(function (n) { return n.tagName === 'TH'; });
  check('thead row has 15 <th> after JS render (5 base + 10 criteria)', ths.length === 15, 'got ' + ths.length);

  // Tbody should have 2 <tr data-ht-tool> rows.
  const trs = tbody.children.filter(function (n) { return n.tagName === 'TR'; });
  check('tbody has 2 <tr> rows', trs.length === 2, 'got ' + trs.length);
  check('each <tr> has data-ht-tool attribute',
    trs.every(function (tr) { return tr.getAttribute('data-ht-tool'); }));

  // Each row has 15 <td> cells (5 meta + 10 criterion).
  const tdCounts = trs.map(function (tr) {
    return tr.children.filter(function (n) { return n.tagName === 'TD'; }).length;
  });
  check('each row has 15 <td> cells (5 meta + 10 criterion)',
    tdCounts.length === 2 && tdCounts[0] === 15 && tdCounts[1] === 15,
    'got ' + JSON.stringify(tdCounts));

  // Rubric summary region has 10 <details>.
  const details = rubricList.children.filter(function (n) { return n.tagName === 'DETAILS'; });
  check('rubric summary has 10 <details> accordions', details.length === 10, 'got ' + details.length);

  // Slug sort — alpha-tool comes before beta-tool.
  check('rows sorted by slug (alpha before beta)',
    trs[0] && trs[0].getAttribute('data-ht-tool') === 'alpha-tool' &&
    trs[1] && trs[1].getAttribute('data-ht-tool') === 'beta-tool',
    'got ' + trs.map(function (t) { return t.getAttribute('data-ht-tool'); }).join(','));

  // Score formatting — first row has score 9, second has 6.
  const scoreCells = trs.map(function (tr) {
    const cells = tr.children.filter(function (n) { return n.tagName === 'TD'; });
    return cells[2];
  });
  check('row 1 score cell reads "9"',
    scoreCells[0] && scoreCells[0]._text === '9',
    'got "' + (scoreCells[0] && scoreCells[0]._text) + '"');
  check('row 2 score cell reads "6"',
    scoreCells[1] && scoreCells[1]._text === '6',
    'got "' + (scoreCells[1] && scoreCells[1]._text) + '"');

  // Date formatting — "2026-08-01" for alpha, "2026-07-15" for beta.
  const dateCells = trs.map(function (tr) {
    const cells = tr.children.filter(function (n) { return n.tagName === 'TD'; });
    return cells[3];
  });
  check('row 1 date cell reads "2026-08-01"',
    dateCells[0] && dateCells[0]._text === '2026-08-01',
    'got "' + (dateCells[0] && dateCells[0]._text) + '"');
  check('row 2 date cell reads "2026-07-15"',
    dateCells[1] && dateCells[1]._text === '2026-07-15',
    'got "' + (dateCells[1] && dateCells[1]._text) + '"');

  // Waivered sub-8 tool (beta-tool) carries the row-waiver class.
  check('row for sub-8 waived tool has row-waiver class',
    trs[1] && trs[1].classList && trs[1].classList._set.has('row-waiver'),
    'class set: ' + Array.from(trs[1].classList._set).join(','));
  check('row for sub-8 tool has row-below-bar class',
    trs[1] && trs[1].classList && trs[1].classList._set.has('row-below-bar'));

  // Remediation toggle — dispatch a real click event through the handler
  // attachCellHandlers registered, and assert that the script inserts a
  // detail row under the row. This is the AC-8 verification that the
  // click path actually works (not just that insertBefore works on the
  // synthetic DOM).
  const alphaCells = trs[0].children.filter(function (n) { return n.tagName === 'TD'; });
  const alphaFirstCriterion = alphaCells[5];
  if (alphaFirstCriterion) {
    const before = tbody.children.filter(function (n) {
      return n.classList && n.classList._set.has('ht-quality-remediation-row');
    }).length;
    dispatchOn(alphaFirstCriterion, 'click', { type: 'click', target: alphaFirstCriterion });
    const after1 = tbody.children.filter(function (n) {
      return n.classList && n.classList._set.has('ht-quality-remediation-row');
    }).length;
    check('clicking a criterion cell inserts a remediation row',
      after1 === before + 1, 'before=' + before + ' after=' + after1);

    // Click the SAME cell again — should TOGGLE (is-open class) without
    // adding another detail row.
    dispatchOn(alphaFirstCriterion, 'click', { type: 'click', target: alphaFirstCriterion });
    const after2 = tbody.children.filter(function (n) {
      return n.classList && n.classList._set.has('ht-quality-remediation-row');
    }).length;
    check('clicking the same cell a second time does not add another detail row',
      after2 === after1, 'got ' + after2);

    // Click a DIFFERENT criterion cell on the same row — should REPLACE
    // the existing detail row's content (not toggle) so the displayed
    // remediation matches the new criterion.
    const alphaSecondCriterion = alphaCells[6];
    if (alphaSecondCriterion) {
      dispatchOn(alphaSecondCriterion, 'click', { type: 'click', target: alphaSecondCriterion });
      const after3 = tbody.children.filter(function (n) {
        return n.classList && n.classList._set.has('ht-quality-remediation-row');
      }).length;
      check('clicking a different criterion cell keeps exactly one detail row',
        after3 === after1, 'got ' + after3);
      // The remaining detail row should be tagged with the new criterion.
      const remRow = tbody.children.filter(function (n) {
        return n.classList && n.classList._set.has('ht-quality-remediation-row');
      })[0];
      check('detail row carries the latest clicked criterion',
        remRow && remRow.getAttribute('data-criterion') === '2',
        'got ' + (remRow && remRow.getAttribute('data-criterion')));
    }

    // Hover should ALSO insert a remediation row (AC-3: click or hover).
    const alphaThirdCriterion = alphaCells[7];
    if (alphaThirdCriterion) {
      const beforeHover = tbody.children.filter(function (n) {
        return n.classList && n.classList._set.has('ht-quality-remediation-row');
      }).length;
      dispatchOn(alphaThirdCriterion, 'mouseenter', { type: 'mouseenter', target: alphaThirdCriterion });
      const afterHover = tbody.children.filter(function (n) {
        return n.classList && n.classList._set.has('ht-quality-remediation-row');
      }).length;
      check('hovering a criterion cell inserts a remediation row (AC-3)',
        afterHover >= beforeHover, 'before=' + beforeHover + ' after=' + afterHover);
    }
  } else {
    check('first criterion cell exists', false);
  }

  // Public API.
  const HT = ctx.window.HT || {};
  check('HT.quality is exposed', HT.quality != null);
  check('HT.quality.version === "1.0.0"', HT.quality && HT.quality.version === '1.0.0');
  check('HT.quality is frozen', HT.quality && Object.isFrozen(HT.quality));
  check('HT.quality.ready === true', HT.quality && HT.quality.ready === true);
  check('HT.quality.data exposes fetched payload',
    HT.quality && HT.quality.data && Array.isArray(HT.quality.data.tools) && HT.quality.data.tools.length === 2);
  check('HT.quality.criteria has 10 entries',
    HT.quality && Array.isArray(HT.quality.criteria) && HT.quality.criteria.length === 10);

  // Rubric parsing — confirm the parser captured the verbatim quoted text.
  const crit1 = HT.quality.criteria[0];
  check('criterion 1 name = "Keyboard-complete"',
    crit1 && crit1.name === 'Keyboard-complete',
    'got "' + (crit1 && crit1.name) + '"');
  check('criterion 1 remediation text extracted verbatim',
    crit1 && /No keyboard listener detected/.test(crit1.remediation),
    'got "' + (crit1 && crit1.remediation) + '"');

  // Meta line — "Generated" + releaseVersion + tool count.
  check('meta line includes release version + tool count + generated date',
    /Release 9\.9\.9-test/.test(meta._text) &&
    /Generated /.test(meta._text) &&
    /2 tools/.test(meta._text),
    'got: ' + meta._text);

  // Vacuous-pass guard.
  if (pass === 0 && fail === 0) {
    console.error('  VACUOUS — no assertions ran');
    process.exit(1);
  }
  if (fail > 0) process.exit(1);
  console.log('\n  ' + pass + ' PASS · ' + fail + ' FAIL');
  process.exit(fail > 0 ? 1 : 0);
}
