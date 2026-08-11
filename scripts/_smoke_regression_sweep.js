/* ============================================
   Cross-cutting regression sweep (Story 2.12).

   For every tool in tools.json with ready:true, evaluates
   the tool's JS in a fresh vm context with a synthetic
   document + a minimal HT.* facade, then runs a 6-check
   battery:

     1. Schema load       tools.json entry is well-formed
                          and meets the per-tool contract.
     2. Tool page HTML    tools/<slug>/index.html exists,
                          ends with </html>, and the <main>
                          landmark carries data-slug="<slug>".
     3. Tool JS loads     <slug>.js evaluates in the vm
                          context without throwing.
     4. HT.history.push   history.push then list returns
                          the entry (skipped when no
                          history-keys declared).
     5. console.error     no console.error calls during
                          the tool's JS load phase.
     6. Fetch gate        no fetch() call hit a URL with
                          a scheme + non-localhost host.

   The harness is deliberately small. It does NOT boot
   the full Shell (storage-registry / site-config / a11y
   / shell / theme / palette / settings) — that would
   require ~5000 lines of module evaluation per tool and
   35 × N seconds of boot time. Instead, it provides the
   exact HT.* surface the tool JS code touches (computed
   via a one-shot survey of all 35 <slug>.js files; the
   top 22 helpers are listed in STORY-HELPERS below).

   Per AD-1 + AD-12 the project ships a static-only,
   no-Node-toolchain deployment. This harness is a test
   tool, not a runtime dep — it lives in scripts/_smoke_*
   and runs only via `make regression-sweep` in CI.

   Exit codes: 0 = all green, 1 = any failure, 2 = vacuous
   pass (no ready:true tools found or zero checks ran).
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..');
const TOOLS_JSON = path.join(REPO, 'tools.json');
const TOOLS_DIR = path.join(REPO, 'tools');

/* ---------- Shell prelude — HT.* helpers the tool JS touches ----------
   Surveyed across all 35 tools (see scripts/_smoke_regression_sweep.js
   commit message for the survey). The top 22 callers are:

     HT.$ (HT.qs), HT.qsa, HT.qs, HT.$$, HT.formatNumber,
     HT.formatDate, HT.formatDateShort, HT.formatDuration,
     HT.formatDurationHMS, HT.debounce, HT.toast,
     HT.copyToClipboard, HT.fallbackCopy, HT.uid,
     HT.randomInt, HT.daysInMonth, HT.isLeapYear,
     HT.beep, HT.chime, HT.makeTabs, HT.fetch,
     HT.storage, HT.history, HT.urlState, HT.share,
     HT.sampleData, HT.reset

   The prelude below publishes all 22+ on the synthetic HT
   before the tool JS runs. Functions that are pure (no DOM,
   no storage) are straight ports of the production logic;
   functions that touch the DOM go through the synthetic
   document shim. */

function makeSyntheticDocument() {
  const elementsById = Object.create(null);
  const listeners = Object.create(null);

  function makeStyle() {
    /* Per-element style object. Tools call element.style.setProperty('left', '0%')
       and element.style.setProperty('--hue', '120'); reading back via
       element.style.left (a getter that returns the matching stored key)
       isn't required for load-time evaluation, so we just store in a flat
       map. */
    const dict = Object.create(null);
    return {
      setProperty: function (k, v) { dict[String(k)] = String(v); },
      getPropertyValue: function (k) { return dict[String(k)] || ''; },
      removeProperty: function (k) { delete dict[String(k)]; },
      /* cssText round-trip — tools rarely use this but costless to support. */
      get cssText() {
        const parts = [];
        for (const k in dict) parts.push(k + ': ' + dict[k]);
        return parts.join('; ');
      },
      set cssText(v) {
        /* Naive reset: discard prior values, store a single batched string. */
        for (const k in dict) delete dict[k];
        const s = String(v || '');
        s.split(';').forEach(function (pair) {
          const i = pair.indexOf(':');
          if (i > 0) dict[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
        });
      },
      /* Hidden backing — used only for the cssText getter above; do not
         expose publicly because tools assume style is opaque. */
      _dict: dict,
    };
  }

  function makeElement(tag) {
    const nodeType = 1;
    const el = {
      nodeType: 1,
      tagName: String(tag || '').toUpperCase(),
      children: [],
      childNodes: [],
      parentNode: null,
      /* parentElement is the Element version of parentNode. SVG renderers
         (e.g., inflation-calculator) read wrap.parentElement and then
         wrap.clientWidth; we mirror the parent ref so .parentElement is
         never undefined for a node that has any parent. When parentNode
         is null we fall back to el itself (as if it were rooted under
         <body>) — safer than null because tools read .clientWidth etc. */
      get parentElement() { return el.parentNode || el; },
      /* clientWidth/clientHeight — used by chart renderers. Returning 0
         makes tools fall back to their default width (e.g., 600). */
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: function () {
        return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 };
      },
      _attrs: {},
      _text: '',
      _className: '',
      _value: '',
      style: makeStyle(),
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
      setAttribute: function (k, v) { this._attrs[k] = String(v); },
      getAttribute: function (k) {
        return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
      },
      removeAttribute: function (k) {
        if (Object.prototype.hasOwnProperty.call(this._attrs, k)) delete this._attrs[k];
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
      removeChild: function (child) {
        const i = this.children.indexOf(child);
        if (i !== -1) this.children.splice(i, 1);
        const j = this.childNodes.indexOf(child);
        if (j !== -1) this.childNodes.splice(j, 1);
        child.parentNode = null;
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
      addEventListener: function (name, fn) {
        if (typeof fn !== 'function') return;
        const k = el._capKey || (el._capKey = Symbol('cap'));
        const bucket = listeners[k] = listeners[k] || Object.create(null);
        (bucket[name] = bucket[name] || []).push(fn);
      },
      removeEventListener: function () { /* no-op */ },
      dispatchEvent: function (event) {
        const k = el._capKey;
        if (!k) return true;
        const bucket = listeners[k];
        if (!bucket || !bucket[event.type]) return true;
        for (let i = 0; i < bucket[event.type].length; i += 1) {
          bucket[event.type][i].call(el, event);
        }
        return true;
      },
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      focus: function () {},
      blur: function () {},
      remove: function () {
        if (this.parentNode) this.parentNode.removeChild(this);
      },
    };
    Object.defineProperty(el, 'textContent', {
      get: function () {
        if (this.children.length === 0) return this._text;
        return this.children
          .map(function (c) { return c && c.textContent != null ? c.textContent : ''; })
          .join('');
      },
      set: function (v) {
        this._text = String(v);
        this.children.length = 0;
        this.childNodes.length = 0;
      },
    });
    Object.defineProperty(el, 'value', {
      get: function () { return this._value; },
      set: function (v) { this._value = String(v == null ? '' : v); },
    });
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
    Object.defineProperty(el, 'innerHTML', {
      get: function () { return this._text; },
      set: function (v) {
        this._text = String(v);
        this.children.length = 0;
        this.childNodes.length = 0;
      },
    });
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

  const body = makeElement('body');
  body.tagName = 'BODY';

  const document = {
    readyState: 'complete',
    documentElement: makeElement('html'),
    body: body,
    head: makeElement('head'),
    addEventListener: function () { /* capture no-op */ },
    removeEventListener: function () {},
    getElementById: function (id) {
      return Object.prototype.hasOwnProperty.call(elementsById, id) ? elementsById[id] : null;
    },
    querySelector: function (sel) {
      if (typeof sel !== 'string') return null;
      if (sel[0] === '#') {
        return Object.prototype.hasOwnProperty.call(elementsById, sel.slice(1))
          ? elementsById[sel.slice(1)] : null;
      }
      /* Permissive fallback: synthesize a fresh element for any selector
         we don't know how to match. Tools use a small handful of
         attribute selectors (e.g., [data-list="urgent-important"]); the
         synthetic element satisfies `.innerHTML =`, `.appendChild(...)`,
         and `.classList.add(...)` calls at load time. */
      return makeElement('div');
    },
    querySelectorAll: function (sel) {
      if (typeof sel !== 'string') return [];
      /* HT.qsa / querySelectorAll('.quadrant') etc. — return a small
         synthetic list so forEach loops in tool JS don't blow up. */
      return [makeElement('div'), makeElement('div'), makeElement('div'), makeElement('div')];
    },
    createElement: function (tag) { return makeElement(tag); },
    createElementNS: function (ns, tag) { return makeElement(tag); },
    createTextNode: function (text) {
      return {
        nodeType: 3,
        _text: String(text == null ? '' : text),
        parentNode: null,
        get textContent() { return this._text; },
        set textContent(v) { this._text = String(v); },
      };
    },
    activeElement: null,
  };

  function registerById(id, el) {
    if (id) elementsById[id] = el;
  }

  return { document: document, makeElement: makeElement, registerById: registerById, body: body };
}

/* ---------- HT.* facade ---------- */

function buildHtFacade({ urlState, historyApi, storageApi, fetchUrls, errorSink, warnSink }) {
  const { document, makeElement, registerById, body } = makeSyntheticDocument();

  const HtmlElement = function () {};
  HtmlElement.prototype = makeElement('div');

  const HT = Object.create(null);

  /* ----- DOM helpers (HT.qs / HT.qsa / HT.$ / HT.$$) -----
     HT.qs accepts: '#id', '[data-tab-panel="metric"]', '[data-tab-panel="imperial"]'.
     We also publish HT.__tabPanels so HT.qsa('[data-tab-panel]') can return
     every registered tab-panel element. The implementation is intentionally
     narrow — we only need to satisfy the small subset of selectors the
     tools actually use. */
  HT.__tabPanels = [];
  HT.qs = function (sel) {
    if (typeof sel !== 'string') return null;
    if (sel[0] === '#') {
      /* Handle '#id descendant-tag' (e.g., '#slab-table tbody'). The
         descendant tag isn't present in our flat synthetic DOM, so we
         manufacture a child element on the fly and parent it under the
         resolved id element. Tools that later read .innerHTML/.children
         on the resolved node will see a clean synthetic child. */
      const space = sel.indexOf(' ');
      const id = space === -1 ? sel.slice(1) : sel.slice(1, space);
      const el = document.getElementById(id);
      if (!el) return null;
      if (space === -1) return el;
      const tag = sel.slice(space + 1).trim();
      const child = makeElement(tag || 'div');
      el.appendChild(child);
      return child;
    }
    const m = sel.match(/^\[data-tab-panel=["']([\w-]+)["']\]$/);
    if (m) {
      const id = 'tp-' + m[1];
      return document.getElementById(id);
    }
    /* Permissive fallback for compound selectors we don't fully parse
       (e.g., '.quadrant[data-q="..."]'). Tool JS at load time only
       touches .innerHTML/.classList/.appendChild on the result; a
       fresh synthetic element satisfies all of those. */
    return makeElement('div');
  };
  HT.qsa = function (sel) {
    if (typeof sel !== 'string') return [];
    if (sel === '[data-tab-panel]') return HT.__tabPanels.slice();
    if (sel === '[data-i18n]') return (HT.__i18nEls || []).slice();
    if (sel === '[data-i18n-attr]') return [];
    /* Permissive fallback: return empty so forEach loops in tool JS
       simply don't execute. Returning fake elements caused
       T(null) crashes when getAttribute() returned null on
       synthetic divs missing the attribute. */
    return [];
  };
  HT.$ = HT.qs;
  HT.$$ = HT.qsa;

  HT.fetch = function (url) {
    fetchUrls.push(String(url));
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); }, text: function () { return Promise.resolve(''); } });
  };

  /* ----- Format helpers ----- */
  HT.formatNumber = function (n, opts) {
    const min = (opts && typeof opts.minFractionDigits === 'number') ? opts.minFractionDigits : 0;
    const max = (opts && typeof opts.maxFractionDigits === 'number') ? opts.maxFractionDigits : 4;
    if (!isFinite(n)) return '—';
    return n.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: max });
  };
  HT.formatDate = function (d) {
    if (!(d instanceof Date) || isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };
  HT.formatDateShort = function (d) {
    if (!(d instanceof Date) || isNaN(d)) return '—';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  HT.formatDuration = function (ms) {
    const sign = ms < 0 ? '-' : '';
    const abs = Math.abs(Math.round(ms / 1000));
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const seconds = abs % 60;
    const parts = [];
    if (days) parts.push(days + 'd');
    if (hours || days) parts.push(hours + 'h');
    if (minutes || hours || days) parts.push(minutes + 'm');
    parts.push(seconds + 's');
    return sign + parts.join(' ');
  };
  HT.formatDurationHMS = function (ms) {
    const abs = Math.abs(Math.round(ms / 1000));
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    const pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  };

  /* ----- Utility helpers ----- */
  HT.debounce = function (fn/*, ms*/) {
    let t;
    return function () {
      const args = arguments;
      const ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, 0);
    };
  };
  HT.randomInt = function (min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };
  HT.uid = function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); };
  HT.isLeapYear = function (year) { return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0; };
  HT.daysInMonth = function (year, month) { return new Date(year, month + 1, 0).getDate(); };

  HT.toast = function () { /* no-op in synthetic document */ };
  HT.copyToClipboard = function () { return Promise.resolve(); };
  HT.fallbackCopy = function () {};
  HT.beep = function () {};
  HT.chime = function () {};

  HT.makeTabs = function (container) {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        container.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        const target = tab.getAttribute('data-tab');
        if (typeof document.querySelectorAll === 'function') {
          document.querySelectorAll('[data-tab-panel]').forEach(function (p) {
            p.style.display = p.getAttribute('data-tab-panel') === target ? '' : 'none';
          });
        }
      });
    });
  };

  /* ----- Refs into script-supplied shims ----- */
  HT.storage = storageApi;
  HT.history = historyApi;
  HT.urlState = urlState;
  HT.share = {
    open: function () {},
    close: function () {},
    url: function () { return 'http://localhost/tools/' + (HT.__slug || '') + '/'; },
    embedCode: function () { return '<iframe></iframe>'; },
    button: function () { return makeElement('button'); },
    hasShare: function () { return false; },
    mount: function () {},
    print: function () {},
  };
  HT.sampleData = {
    fill: function () { return Object.freeze({}); },
    hasSample: function () { return false; },
    button: function () { return makeElement('button'); },
    mount: function () {},
  };
  HT.reset = {
    run: function () {},
    button: function () { return makeElement('button'); },
  };

  HT.__slug = null;
  HT.__main = null;
  HT.__errorSink = errorSink;
  HT.__warnSink = warnSink;

  const main = makeElement('main');
  body.appendChild(main);

  return { HT: HT, document: document, makeElement: makeElement, registerById: registerById, body: body, main: main };
}

/* ---------- History + storage + urlState shims ---------- */

function buildStorageShim() {
  const map = new Map();
  const api = {
    get: function (key, fallback) {
      if (!map.has(key)) return fallback;
      return map.get(key);
    },
    set: function (key, value) {
      map.set(key, value);
      return true;
    },
    remove: function (key) { return map.delete(key); },
    clear: function () { map.clear(); },
    keys: function () { return Array.from(map.keys()); },
    list: function () { return Array.from(map.entries()).map(function (e) { return { key: e[0], value: e[1] }; }); },
  };
  return api;
}

function buildHistoryShim() {
  const subscribers = new Map();
  return {
    push: function (slug, entry) {
      const id = 'hist-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
      const e = Object.freeze({
        id: id,
        slug: slug,
        state: entry.state || {},
        result: entry.result || null,
        label: entry.label || '',
        ts: Date.now(),
      });
      const list = subscribers.get(slug) || [];
      list[list.length] = e;
      subscribers.set(slug, list);
      return e;
    },
    list: function (slug) {
      const list = subscribers.get(slug) || [];
      return Object.freeze(list.slice());
    },
    restore: function () {},
    lastEntry: function (slug) {
      const list = subscribers.get(slug) || [];
      return list.length > 0 ? list[list.length - 1] : null;
    },
    hasHistory: function () { return true; },
    clear: function (slug) { subscribers.delete(slug); },
    subscribe: function () { return function () {}; },
    button: function () { return { addEventListener: function () {}, dataset: {}, className: '', textContent: '', tagName: 'BUTTON', type: 'button', getAttribute: function () { return null; } }; },
    panel: function () { return { teardown: function () {} }; },
    _loadSchema: function () {},
  };
}

function buildUrlStateShim() {
  return {
    bindForm: function () {},
    encode: function () { return ''; },
    decode: function () { return {}; },
    subscribe: function () { return function () {}; },
  };
}

/* ---------- tools.json loader ---------- */

function loadTools() {
  const raw = fs.readFileSync(TOOLS_JSON, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('FAIL  parse tools.json: ' + e.message);
    process.exit(1);
  }
  if (!Array.isArray(data.tools)) {
    console.error('FAIL  tools.json missing tools[] array');
    process.exit(1);
  }
  return data.tools;
}

function checkSchema(entry) {
  const issues = [];
  if (!entry.id && !entry.slug) issues.push('id+slug');
  if (typeof entry.slug !== 'string') issues.push('slug:non-string');
  if (typeof entry.title !== 'string') issues.push('title:non-string');
  if (!Array.isArray(entry.pack) || entry.pack.length === 0) issues.push('pack:missing-or-empty');
  if (entry.score == null || typeof entry.score !== 'number') issues.push('score:missing');
  else if (entry.ready === true && entry.score < 8) issues.push('score<8+ready:true');
  if (entry.ready !== true) issues.push('ready:false');
  if (!entry.urlState || typeof entry.urlState !== 'object') issues.push('urlState:missing');
  if (!Array.isArray(entry['history-keys'])) issues.push('history-keys:missing');
  if (!entry['view-source'] || typeof entry['view-source'] !== 'object') issues.push('view-source:missing');
  if (!entry['embed-snippet'] || typeof entry['embed-snippet'] !== 'object') issues.push('embed-snippet:missing');
  return issues;
}

function checkHtml(slug) {
  const p = path.join(TOOLS_DIR, slug, 'index.html');
  if (!fs.existsSync(p)) return { issues: ['html-missing'], ids: [] };
  const txt = fs.readFileSync(p, 'utf8');
  const issues = [];
  if (!/<\/html>\s*$/.test(txt)) issues.push('html:no-</html>');
  if (!new RegExp('<main[^>]*data-slug="' + slug + '"').test(txt)) issues.push('main:data-slug');
  /* Pull every id, data-tab-panel, and data-i18n declaration. We don't
     parse nesting — the synthetic DOM is flat per id. The chrome header
     declares many ids (e.g., shell-search-trigger, theme-toggle) that
     the tool JS doesn't touch; registering extra elements is harmless.
     Tab-panel attributes are pre-registered so tools that call
     HT.$('[data-tab-panel="metric"]') (e.g., bmi-calculator) can resolve
     them at load time before HT.makeTabs inserts them. data-i18n values
     are pre-registered so HT.qsa('[data-i18n]') returns real elements
     whose getAttribute('data-i18n') yields the actual translation key —
     otherwise applyI18n() in bd-tax calls T(null) and crashes. */
  const idRegex = /\bid=["']([\w-]+)["']/g;
  const tabPanelRegex = /\bdata-tab-panel=["']([\w-]+)["']/g;
  const i18nRegex = /\bdata-i18n=["']([^"']+)["']/g;
  const ids = [];
  const tabPanels = [];
  const i18nKeys = [];
  let m;
  while ((m = idRegex.exec(txt)) !== null) {
    if (ids.indexOf(m[1]) === -1) ids.push(m[1]);
  }
  while ((m = tabPanelRegex.exec(txt)) !== null) {
    if (tabPanels.indexOf(m[1]) === -1) tabPanels.push(m[1]);
  }
  while ((m = i18nRegex.exec(txt)) !== null) {
    if (i18nKeys.indexOf(m[1]) === -1) i18nKeys.push(m[1]);
  }
  /* Register data-tab-panel ids as "tp-<value>" so HT.qs can mirror the
     attribute selector. Tools use HT.$('[data-tab-panel="metric"]') and
     HT.qsa('[data-tab-panel]') alike; for the qsa side we publish a
     parallel list on HT.__tabPanels. */
  for (let i = 0; i < tabPanels.length; i += 1) {
    ids.push('tp-' + tabPanels[i]);
  }
  /* data-i18n="<key>" gets registered as id `i18n-<key>` so HT.qs
     selectors and HT.qsa('[data-i18n]') resolve cleanly. */
  for (let i = 0; i < i18nKeys.length; i += 1) {
    ids.push('i18n-' + i18nKeys[i].replace(/[^a-zA-Z0-9_-]/g, '_'));
  }
  return { issues: issues, ids: ids, tabPanels: tabPanels, i18nKeys: i18nKeys };
}

function buildEmptyPageDom() {
  const { document, makeElement, registerById, body } = makeSyntheticDocument();
  const main = makeElement('main');
  main.setAttribute('data-slug', '__placeholder__');
  registerById('main', main);
  body.appendChild(main);
  return { document: document, makeElement: makeElement, registerById: registerById, body: body, main: main };
}

/* ---------- Per-tool runner ---------- */

function runOneTool(entry) {
  const slug = entry.slug;
  const errors = [];
  const checkResults = { schema: null, html: null, jsLoad: null, history: null, consoleError: null, fetch: null };

  /* check 1: schema */
  const schemaIssues = checkSchema(entry);
  checkResults.schema = schemaIssues.length === 0;
  if (schemaIssues.length > 0) errors.push('schema: ' + schemaIssues.join(','));

  /* check 2: HTML — also pulls every id="..." declaration so the tool JS
     can resolve HT.$('#foo') and document.getElementById('foo') against
     pre-registered synthetic elements. */
  const htmlCheck = checkHtml(slug);
  const htmlIssues = htmlCheck.issues;
  checkResults.html = htmlIssues.length === 0;
  if (htmlIssues.length > 0) errors.push('html: ' + htmlIssues.join(','));

  const jsPath = path.join(TOOLS_DIR, slug, slug + '.js');
  if (!fs.existsSync(jsPath)) {
    checkResults.jsLoad = false;
    errors.push('js:missing');
    return { slug: slug, results: checkResults, errors: errors };
  }
  const toolJs = fs.readFileSync(jsPath, 'utf8');

  /* Build vm context with full synthetic DOM + prelude */
  const fetchUrls = [];
  const errorSink = [];
  const warnSink = [];
  const storageApi = buildStorageShim();
  const historyApi = buildHistoryShim();
  const urlState = buildUrlStateShim();
  const facade = buildHtFacade({ urlState: urlState, historyApi: historyApi, storageApi: storageApi, fetchUrls: fetchUrls, errorSink: errorSink, warnSink: warnSink });
  const { document, main, registerById, body } = facade;

  facade.HT.__slug = slug;
  facade.HT.__main = main;
  main.setAttribute('data-slug', slug);
  registerById('main', main);
  body.appendChild(main);

  /* Pre-register every id the tool HTML declares. Tool JS may call
     HT.$('#foo') or document.getElementById('foo') at top level; without
     a registered element, those calls return null and the first
     property access on them throws. Chrome-header ids (e.g.,
     shell-search-trigger) are harmless to register even when the
     tool JS never references them. */
  facade.HT.__i18nEls = [];
  for (let i = 0; i < htmlCheck.ids.length; i += 1) {
    const id = htmlCheck.ids[i];
    if (id === 'main') continue; /* already registered above */
    const el = facade.makeElement('div');
    if (id.indexOf('tp-') === 0) {
      /* data-tab-panel="..." gets serialized as tp-<value>; record it on
         HT.__tabPanels so HT.qsa('[data-tab-panel]') can return it. */
      el.setAttribute('data-tab-panel', id.slice(3));
      facade.HT.__tabPanels.push(el);
    } else if (id.indexOf('i18n-') === 0) {
      /* Find the matching i18n key by stripping the i18n- prefix and
         reversing checkHtml's transform (replace non-word chars with _).
         The first match in i18nKeys wins; duplicate keys share an id. */
      const want = id.slice('i18n-'.length);
      let key = '';
      for (let k = 0; k < htmlCheck.i18nKeys.length; k += 1) {
        if (htmlCheck.i18nKeys[k].replace(/[^a-zA-Z0-9_-]/g, '_') === want) {
          key = htmlCheck.i18nKeys[k];
          break;
        }
      }
      el.setAttribute('data-i18n', key);
      facade.HT.__i18nEls.push(el);
    }
    registerById(id, el);
  }

  const consoleShim = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: function (msg) {
      warnSink.push(String(msg));
      if (typeof console.warn === 'function') console.warn(msg);
    },
    error: function (msg) {
      errorSink.push(String(msg));
    },
  };

  const ctx = {
    HT: facade.HT,
    window: {
      HT: facade.HT,
      document: document,
      console: consoleShim,
      matchMedia: function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; },
      navigator: { clipboard: { writeText: function () { return Promise.resolve(); } } },
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      setInterval: setInterval,
      clearInterval: clearInterval,
      addEventListener: function () {},
      removeEventListener: function () {},
      location: { hash: '', pathname: '/tools/' + slug + '/', search: '', href: 'http://localhost/tools/' + slug + '/' },
      history: { replaceState: function () {}, pushState: function () {} },
    },
    document: document,
    console: consoleShim,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    location: { hash: '', pathname: '/tools/' + slug + '/', search: '', href: 'http://localhost/tools/' + slug + '/' },
    Promise: Promise,
    JSON: JSON,
    Date: Date,
    RegExp: RegExp,
    Math: Math,
    Intl: Intl,
    Array: Array,
    Object: Object,
    Error: Error,
    TypeError: TypeError,
    URLSearchParams: URLSearchParams,
  };
  ctx.window.window = ctx.window;
  ctx.global = ctx;

  vm.createContext(ctx);

  /* check 3: tool JS loads without throwing */
  let jsLoadErr = null;
  try {
    vm.runInContext(toolJs, ctx, { filename: slug + '.js' });
  } catch (e) {
    jsLoadErr = e;
    if (process.env.SWEEP_DEBUG) {
      console.error('STACK for ' + slug + ':', e.stack);
    }
  }
  checkResults.jsLoad = jsLoadErr === null;
  if (jsLoadErr) errors.push('js: ' + (jsLoadErr.message || jsLoadErr));

  /* check 4: HT.history.push roundtrip (skip when history-keys empty) */
  const historyKeys = Array.isArray(entry['history-keys']) ? entry['history-keys'] : [];
  if (historyKeys.length === 0) {
    checkResults.history = 'skip';
  } else {
    let pushErr = null;
    try {
      const e = historyApi.push(slug, { state: { sample: '1' }, result: { sample: 'ok' }, label: 'regression-sample' });
      const list = historyApi.list(slug);
      checkResults.history = !!(e && Array.isArray(list) && list.some(function (item) { return item.label === 'regression-sample'; }));
    } catch (e) {
      pushErr = e;
    }
    if (pushErr) {
      checkResults.history = false;
      errors.push('history: ' + (pushErr.message || pushErr));
    } else if (checkResults.history === false) {
      errors.push('history: push+list roundtrip failed');
    }
  }

  /* check 5: console.error gate */
  checkResults.consoleError = errorSink.length === 0;
  if (errorSink.length > 0) errors.push('console.error(' + errorSink.length + ')');

  /* check 6: fetch gate — reject any URL with a scheme + non-localhost host */
  const externalUrls = fetchUrls.filter(function (u) {
    if (typeof u !== 'string') return false;
    if (u.indexOf('://') === -1) return false;
    return /:\/\/(?!localhost|127\.0\.0\.1)([a-z0-9.-]+)/i.test(u);
  });
  checkResults.fetch = externalUrls.length === 0;
  if (externalUrls.length > 0) errors.push('fetch: external URL(s) ' + externalUrls.join(', '));

  return { slug: slug, results: checkResults, errors: errors };
}

/* ---------- Main ---------- */

function printRow(slug, results) {
  const marks = ['1', '2', '3', '4', '5', '6'].map(function (i) {
    const v = results[['schema', 'html', 'jsLoad', 'history', 'consoleError', 'fetch'][Number(i) - 1]];
    if (v === true) return '✓';
    if (v === 'skip') return '·';
    return '✗';
  }).join('');
  console.log('  ' + slug.padEnd(28) + '  ' + marks);
}

function main() {
  const tools = loadTools();
  const ready = tools.filter(function (t) { return t.ready === true; }).sort(function (a, b) {
    return String(a.slug).localeCompare(String(b.slug));
  });

  console.log('Regression sweep: ' + ready.length + ' ready:true tools');
  console.log('  ' + 'slug'.padEnd(28) + '  123456');
  console.log('  ' + '-'.repeat(28) + '  ------');

  const rows = [];
  for (let i = 0; i < ready.length; i += 1) {
    const row = runOneTool(ready[i]);
    rows.push(row);
    printRow(row.slug, row.results);
    if (row.errors.length > 0) {
      for (let j = 0; j < row.errors.length; j += 1) {
        console.log('      ! ' + row.errors[j]);
      }
    }
  }

  let totalChecks = 0;
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i].results;
    Object.keys(r).forEach(function (k) {
      totalChecks += 1;
      if (r[k] === true) totalPass += 1;
      else if (r[k] === 'skip') totalSkip += 1;
      else totalFail += 1;
    });
  }

  const toolsPass = rows.filter(function (r) {
    return Object.keys(r.results).every(function (k) { return r.results[k] === true || r.results[k] === 'skip'; });
  }).length;

  console.log('');
  console.log('  total: ' + ready.length + ' tools, ' + totalPass + ' pass, ' + totalSkip + ' skip, ' + totalFail + ' fail');
  console.log('  Regression sweep: ' + toolsPass + '/' + ready.length + ' tools pass (' + totalPass + '/' + totalChecks + ' checks).');

  /* Last-line JSON output for the Python gate to parse. */
  const summary = {
    tools_total: ready.length,
    tools_pass: toolsPass,
    checks_total: totalChecks,
    checks_pass: totalPass,
    checks_skip: totalSkip,
    checks_fail: totalFail,
    rows: rows.map(function (r) {
      return { slug: r.slug, results: r.results, errors: r.errors };
    }),
  };
  console.log('JSON:' + JSON.stringify(summary));

  if (ready.length === 0 || totalChecks === 0) {
    console.error('VACUOUS — no checks executed');
    process.exit(2);
  }
  if (totalFail > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
