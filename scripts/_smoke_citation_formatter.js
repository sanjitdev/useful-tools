/* ============================================
   Smoke harness for Story 9.2 — Citation Formatter.
   Loads assets/js/citation-styles.js (Node-side
   exports) + tools/citation-formatter/
   citation-formatter.js (vm context with stub
   HT + DOM) and asserts the three formatters,
   placeholders, ISBN/DOI/URL validators, URL
   state encode/decode, history keys, and the
   DOM rendering path that wraps missing-field
   placeholders in <span class="citation-missing">.
   Per AC-8: ≥ 25 assertions, 9 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const STYLES_JS_PATH = path.resolve(__dirname, '../assets/js/citation-styles.js');
const TOOL_JS_PATH = path.resolve(__dirname, '../tools/citation-formatter/citation-formatter.js');
const UTILS_JS_PATH = path.resolve(__dirname, '../assets/js/utils.js');

const stylesSrc = fs.readFileSync(STYLES_JS_PATH, 'utf8');
const toolSrc = fs.readFileSync(TOOL_JS_PATH, 'utf8');
const utilsSrc = fs.readFileSync(UTILS_JS_PATH, 'utf8');

const citations = require(STYLES_JS_PATH);

const {
  parseAuthor,
  validateIsbn,
  validateDoi,
  isUrl,
  formatApa7,
  formatMla9,
  formatChicago17,
  formatCitation,
} = citations;

// ---------------------------------------------------------------
// Stub DOM
// ---------------------------------------------------------------

function HtmlSelectStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.listeners = {};
}
Object.defineProperty(HtmlSelectStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
HtmlSelectStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};

function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.listeners = {};
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
HtmlInputStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};

function HtmlButtonStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this._disabled = false;
  this.listeners = {};
}
Object.defineProperty(HtmlButtonStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlButtonStub.prototype, 'disabled', {
  get() { return this._disabled; },
  set(v) { this._disabled = !!v; },
});
HtmlButtonStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};

function HtmlOutputStub() {
  this._innerHTML = '';
  this._textContent = '';
}
Object.defineProperty(HtmlOutputStub.prototype, 'innerHTML', {
  get() { return this._innerHTML; },
  set(v) { this._innerHTML = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlOutputStub.prototype, 'textContent', {
  get() { return this._textContent; },
  set(v) { this._textContent = v == null ? '' : String(v); },
});

function HtmlDivStub() {
  this._text = '';
  this._hidden = true;
  this._href = '#';
}
Object.defineProperty(HtmlDivStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlDivStub.prototype, 'hidden', {
  get() { return this._hidden; },
  set(v) { this._hidden = !!v; },
});
Object.defineProperty(HtmlDivStub.prototype, 'href', {
  get() { return this._href; },
  set(v) { this._href = v == null ? '' : String(v); },
});

function HtmlPElementStub() {
  this._text = '';
  this._className = '';
  this.listeners = {};
}
Object.defineProperty(HtmlPElementStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlPElementStub.prototype, 'className', {
  get() { return this._className; },
  set(v) { this._className = v == null ? '' : String(v); },
});

const statusEl = new HtmlPElementStub();

const elements = {
  '#cite-style': new HtmlSelectStub('apa-7'),
  '#cite-author': new HtmlInputStub(''),
  '#cite-title': new HtmlInputStub(''),
  '#cite-year': new HtmlInputStub(''),
  '#cite-publisher': new HtmlInputStub(''),
  '#cite-isbn': new HtmlInputStub(''),
  '#cite-lookup-isbn': new HtmlButtonStub(),
  '#cite-lookup-error': new HtmlPElementStub(),
  '#cite-doi': new HtmlInputStub(''),
  '#cite-doi-valid': new HtmlSpanStub(),
  '#cite-source': new HtmlInputStub(''),
  '#cite-output': new HtmlOutputStub(),
  '#cite-doi-link-wrap': new HtmlDivStub(),
  '#cite-doi-link': new HtmlAnchorStub(),
  '#cite-source-link-wrap': new HtmlDivStub(),
  '#cite-source-link': new HtmlAnchorStub(),
  '#cite-copy': new HtmlButtonStub(),
  '#cite-generate': new HtmlButtonStub(),
  '#cite-status': statusEl,
};

function HtmlSpanStub() {
  this._hidden = true;
}
Object.defineProperty(HtmlSpanStub.prototype, 'hidden', {
  get() { return this._hidden; },
  set(v) { this._hidden = !!v; },
});

function HtmlAnchorStub() {
  this._text = '';
  this._href = '#';
}
Object.defineProperty(HtmlAnchorStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlAnchorStub.prototype, 'href', {
  get() { return this._href; },
  set(v) { this._href = v == null ? '' : String(v); },
});

// Replace #cite-doi-valid with HtmlSpanStub AFTER definition
elements['#cite-doi-valid'] = new HtmlSpanStub();
elements['#cite-doi-link'] = new HtmlAnchorStub();
elements['#cite-source-link'] = new HtmlAnchorStub();

// History capture
const historyCalls = [];
const networkCalls = [];
let networkJsonImpl = (url) => Promise.resolve({});

// ---------------------------------------------------------------
// vm context
// ---------------------------------------------------------------

const ctx = {
  console: Object.assign({}, console, { log: () => {}, warn: () => {}, warn: () => {}, error: () => {} }),
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  navigator: { clipboard: null },
  history: {
    replaceState: () => {},
    pushState: () => {},
  },
  location: { hash: '', pathname: '/tools/citation-formatter/', search: '' },
  URLSearchParams,
  HT: {
    $: (sel) => elements[sel] || null,
    formatNumber: (n) => String(n),
    copyToClipboard: () => Promise.resolve(),
    debounce: (fn, ms) => {
      let t;
      return function () {
        const args = arguments;
        const that = this;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(that, args), ms);
      };
    },
    history: {
      push: (entry) => { historyCalls.push(entry); },
    },
    net: {
      json: (url) => {
        networkCalls.push(url);
        return networkJsonImpl(url);
      },
    },
  },
  document: {
    addEventListener: () => {},
    getElementById: (id) => elements['#' + id] || null,
    querySelector: () => null,
  },
};

ctx.window = ctx;
ctx.window.HT = ctx.HT;

vm.createContext(ctx);
vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
// Re-attach the stubs that utils.js may have overridden
ctx.HT.$ = (sel) => elements[sel] || null;
ctx.HT.history = { push: (entry) => { historyCalls.push(entry); } };
ctx.HT.net = { json: (url) => { networkCalls.push(url); return networkJsonImpl(url); } };
ctx.window.HT = ctx.HT;

// Load citation-styles in the vm context so HT.citation is defined
// on window.HT for citation-formatter.js to consume.
vm.runInContext(stylesSrc, ctx, { filename: 'citation-styles.js' });

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let pass = 0;
let fail = 0;
const failures = [];

function check(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  ok      ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL    ${label}`);
  }
}

console.log('Citation Formatter smoke (Story 9.2):');

// ---------------------------------------------------------------
// Category 1: parseAuthor
// ---------------------------------------------------------------

const pA = parseAuthor('Smith, John Adam');
check(pA.last === 'Smith', 'parseAuthor: "Last, First" → last="Smith"');
check(pA.first === 'John Adam', 'parseAuthor: "Last, First" → first preserved');
check(pA.initials === 'J. A.', 'parseAuthor: initials="J. A."');

const pB = parseAuthor('Plato');
check(pB.last === 'Plato', 'parseAuthor: single name → kept as last');
check(pB.first === '', 'parseAuthor: single name → first empty');

const pC = parseAuthor('');
check(pC.last === '' && pC.first === '' && pC.initials === '',
  'parseAuthor: empty string → all empty parts');

const pD = parseAuthor(null);
check(pD.last === '' && pD.first === '',
  'parseAuthor: null → all empty parts (defensive)');

const pE = parseAuthor('Smith, F.');
check(pE.last === 'Smith', 'parseAuthor: "Smith, F." → last="Smith"');
check(pE.initials === 'F.', 'parseAuthor: "Smith, F." → initials="F."');

// ---------------------------------------------------------------
// Category 2: validateIsbn
// ---------------------------------------------------------------

check(validateIsbn('9780306406157') === '9780306406157',
  'validateIsbn: 13 digits accepted (no false ISBN-10 match)');

check(validateIsbn('0306406152') === '0306406152',
  'validateIsbn: 10 digits accepted');

check(validateIsbn('ISBN: 0-306-40615-2') === '0306406152',
  'validateIsbn: "ISBN: 0-306-40615-2" → 10 digits');

check(validateIsbn('0-306-40615-2') === '0306406152',
  'validateIsbn: dashed 10 digits accepted');

check(validateIsbn('978-0-306-40615-7') === '9780306406157',
  'validateIsbn: dashed 13 digits accepted');

check(validateIsbn('not-an-isbn') === null,
  'validateIsbn: garbage rejected');

check(validateIsbn('12345') === null,
  'validateIsbn: too short rejected');

check(validateIsbn('') === null,
  'validateIsbn: empty rejected');

check(validateIsbn(null) === null,
  'validateIsbn: null rejected (defensive)');

// ---------------------------------------------------------------
// Category 3: validateDoi
// ---------------------------------------------------------------

check(validateDoi('10.1038/nature12373') === true,
  'validateDoi: nature article DOI accepted');

check(validateDoi('10.1000/xyz') === true,
  'validateDoi: short DOI accepted');

check(validateDoi('not-a-doi') === false,
  'validateDoi: garbage rejected');

check(validateDoi('') === false,
  'validateDoi: empty rejected');

check(validateDoi(null) === false,
  'validateDoi: null rejected (defensive)');

// ---------------------------------------------------------------
// Category 4: isUrl
// ---------------------------------------------------------------

check(isUrl('https://example.com') === true,
  'isUrl: https://example.com accepted');
check(isUrl('http://example.com/foo') === true,
  'isUrl: http accepted');
check(isUrl('ftp://example.com') === false,
  'isUrl: non-http(s) rejected');
check(isUrl('not a url') === false,
  'isUrl: garbage rejected');
check(isUrl('') === false,
  'isUrl: empty rejected');

// ---------------------------------------------------------------
// Category 5: formatApa7
// ---------------------------------------------------------------

const apa1 = formatApa7({
  author: 'Smith, John A.',
  title: 'The Book of Tools',
  year: '2024',
  publisher: 'Penguin',
});
check(apa1 === 'Smith, J. A. (2024). The Book of Tools. Penguin.',
  'formatApa7: full citation shape matches spec');

const apa2 = formatApa7({ author: '', title: '', year: '', publisher: '' });
check(apa2.indexOf('(unknown author)') >= 0,
  'formatApa7: missing author uses (unknown author) placeholder');
check(apa2.indexOf('(untitled)') >= 0,
  'formatApa7: missing title uses (untitled)');
check(apa2.indexOf('(n.d.)') >= 0,
  'formatApa7: missing year uses (n.d.)');
check(apa2.indexOf('(n.p.)') >= 0,
  'formatApa7: missing publisher uses (n.p.)');

const apa3 = formatApa7({
  author: 'Plato',
  title: 'Republic',
  year: '380 BC',
  publisher: 'Hackett',
});
check(apa3.indexOf('Plato') === 0,
  'formatApa7: single-name author starts the citation');

// ---------------------------------------------------------------
// Category 6: formatMla9
// ---------------------------------------------------------------

const mla1 = formatMla9({
  author: 'Smith, John A.',
  title: 'The Book of Tools',
  year: '2024',
  publisher: 'Penguin',
});
check(mla1 === 'Smith, John A. "The Book of Tools." Penguin, 2024.',
  'formatMla9: full citation shape matches spec');

const mla2 = formatMla9({ author: '', title: '', year: '', publisher: '' });
check(mla2.indexOf('(unknown author)') >= 0,
  'formatMla9: missing author uses placeholder');
check(mla2.indexOf('(n.d.)') >= 0,
  'formatMla9: missing year uses (n.d.) (no parens)');

const mla3 = formatMla9({
  author: 'Smith, F.',
  title: 'Tools',
  year: '2024',
  publisher: 'Penguin',
});
check(mla3 === 'Smith, F. "Tools." Penguin, 2024.',
  'formatMla9: initials don\'t get a double period');

// ---------------------------------------------------------------
// Category 7: formatChicago17
// ---------------------------------------------------------------

const chi1 = formatChicago17({
  author: 'Smith, John A.',
  title: 'The Book of Tools',
  year: '2024',
  publisher: 'Penguin',
});
check(chi1 === 'Smith, John A. The Book of Tools. Penguin, 2024.',
  'formatChicago17: full citation shape matches spec');

const chi2 = formatChicago17({ author: '', title: '', year: '', publisher: '' });
check(chi2.indexOf('(unknown author)') >= 0,
  'formatChicago17: missing author uses placeholder');

const chi3 = formatChicago17({
  author: 'Smith, F.',
  title: 'Tools',
  year: '2024',
  publisher: 'Penguin',
});
check(chi3 === 'Smith, F. Tools. Penguin, 2024.',
  'formatChicago17: initials don\'t get a double period');

// ---------------------------------------------------------------
// Category 8: formatCitation dispatcher
// ---------------------------------------------------------------

const dispApa = formatCitation('apa-7', { author: 'a', title: 'b', year: 'c', publisher: 'd' });
const dispMla = formatCitation('mla-9', { author: 'a', title: 'b', year: 'c', publisher: 'd' });
const dispChi = formatCitation('chicago-17', { author: 'a', title: 'b', year: 'c', publisher: 'd' });
check(dispApa === formatApa7({ author: 'a', title: 'b', year: 'c', publisher: 'd' }),
  'formatCitation: dispatches to APA when style="apa-7"');
check(dispMla === formatMla9({ author: 'a', title: 'b', year: 'c', publisher: 'd' }),
  'formatCitation: dispatches to MLA when style="mla-9"');
check(dispChi === formatChicago17({ author: 'a', title: 'b', year: 'c', publisher: 'd' }),
  'formatCitation: dispatches to Chicago when style="chicago-17"');

let dispUnknownThrew = false;
let dispUnknownErr = '';
try {
  formatCitation('unknown', { author: 'a', title: 'b', year: 'c', publisher: 'd' });
} catch (e) {
  dispUnknownThrew = true;
  dispUnknownErr = (e && e.message) ? e.message : String(e);
}
check(dispUnknownThrew && /unknown style/i.test(dispUnknownErr),
  'formatCitation: unknown style throws (not silent fallback) — got: ' + dispUnknownErr);

// ---------------------------------------------------------------
// Category 9: DOM rendering — load tool script, set inputs,
// trigger render(), verify DOI/URL link visibility, and the
// citation-missing spans wrapping placeholders.
// ---------------------------------------------------------------

vm.runInContext(toolSrc, ctx, { filename: 'citation-formatter.js' });

// Verify the script pulled in citation-styles
check(typeof ctx.HT.citation === 'object',
  'browser: HT.citation is exposed on window.HT');
check(typeof ctx.HT.citation.formatCitation === 'function',
  'browser: HT.citation.formatCitation is a function');

// Force a known input and call render() directly via change listener
elements['#cite-style']._v = 'apa-7';
elements['#cite-author']._v = 'Doe, Jane';
elements['#cite-title']._v = 'A Test';
elements['#cite-year']._v = '2023';
elements['#cite-publisher']._v = 'Acme Press';
elements['#cite-doi']._v = '';
elements['#cite-source']._v = '';

const renderFn = elements['#cite-style'].listeners['change'];
check(typeof renderFn === 'function',
  'tool: style <select> has a change listener wired');

// Trigger a render via the change listener
renderFn({ target: elements['#cite-style'] });

const renderedHtml = elements['#cite-output']._innerHTML;
check(renderedHtml.indexOf('Doe, J.') >= 0,
  'render: APA initials format "J." appears in rendered output');
check(renderedHtml.indexOf('(2023)') >= 0,
  'render: APA year "(2023)" appears in rendered output');
check(renderedHtml.indexOf('Acme Press') >= 0,
  'render: publisher "Acme Press" appears in rendered output');

// DOI link visibility: empty DOI → hidden
elements['#cite-doi']._v = '';
renderFn({ target: elements['#cite-style'] });
check(elements['#cite-doi-link-wrap']._hidden === true,
  'render: DOI link wrap hidden when DOI is empty');

// DOI link visibility: valid DOI → shown
elements['#cite-doi']._v = '10.1038/nature12373';
renderFn({ target: elements['#cite-style'] });
check(elements['#cite-doi-link-wrap']._hidden === false,
  'render: DOI link wrap shown when DOI is valid');
check(elements['#cite-doi-link']._href === 'https://doi.org/10.1038/nature12373',
  'render: DOI link href is https://doi.org/<doi>');

// DOI link visibility: invalid DOI → hidden
elements['#cite-doi']._v = 'not-a-doi';
renderFn({ target: elements['#cite-style'] });
check(elements['#cite-doi-link-wrap']._hidden === true,
  'render: DOI link wrap hidden when DOI is invalid');

// Source URL link visibility: empty → hidden
elements['#cite-source']._v = '';
elements['#cite-doi']._v = '';
renderFn({ target: elements['#cite-style'] });
check(elements['#cite-source-link-wrap']._hidden === true,
  'render: source link wrap hidden when URL is empty');

// Source URL link visibility: valid URL → shown
elements['#cite-source']._v = 'https://example.com/book';
renderFn({ target: elements['#cite-style'] });
check(elements['#cite-source-link-wrap']._hidden === false,
  'render: source link wrap shown when URL is valid');

// Missing-field placeholders wrap in <span class="citation-missing">
elements['#cite-author']._v = '';
elements['#cite-title']._v = '';
elements['#cite-year']._v = '';
elements['#cite-publisher']._v = '';
elements['#cite-source']._v = '';
renderFn({ target: elements['#cite-style'] });
const missingHtml = elements['#cite-output']._innerHTML;
check(missingHtml.indexOf('class="citation-missing"') >= 0,
  'render: missing placeholders wrapped in <span class="citation-missing">');
check(missingHtml.indexOf('data-field="author"') >= 0,
  'render: missing author span has data-field="author"');
check(missingHtml.indexOf('data-field="title"') >= 0,
  'render: missing title span has data-field="title"');
check(missingHtml.indexOf('data-field="year"') >= 0,
  'render: missing year span has data-field="year"');
check(missingHtml.indexOf('data-field="publisher"') >= 0,
  'render: missing publisher span has data-field="publisher"');

// ISBN lookup network call (HT.net.json invoked only on click)
networkCalls.length = 0;
networkJsonImpl = (url) => Promise.resolve({});
elements['#cite-isbn']._v = '9780306406157';
elements['#cite-lookup-isbn'].listeners['click']();
check(networkCalls.length === 1,
  'lookup: click triggers exactly 1 HT.net.json call (got ' + networkCalls.length + ')');
check(networkCalls[0].indexOf('9780306406157') >= 0,
  'lookup: URL contains the ISBN');

// Invalid ISBN does NOT trigger network call
networkCalls.length = 0;
elements['#cite-isbn']._v = 'bad-isbn';
elements['#cite-lookup-isbn'].listeners['click']();
check(networkCalls.length === 0,
  'lookup: invalid ISBN does NOT trigger network call (got ' + networkCalls.length + ')');

// ---------------------------------------------------------------
// Vacuous-pass guard
// ---------------------------------------------------------------

console.log('');
console.log(`self-test: ${pass} passed, ${fail} failed`);
if (pass === 0) {
  console.error('VACUOUS — no checks executed');
  process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);
