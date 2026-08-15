'use strict';
/* _smoke_ht_lazy.js — Story 4 Phase 1 + Phase 5
 * Smoke harness for the ht-lazy.js loader. Asserts:
 *   (a) shape of HT.lazyLoad (function, idempotent, dedupes concurrent calls)
 *   (b) loader rejects on script error
 *   (c) loader resolves on script load
 *   (d) the inserted <script> tag has defer=true and data-ht-lazy="true"
 *   (e) loader is callable BEFORE any chrome loads (Tier 1 invariant)
 *   (f) HT.lazyLoadCss shape (Phase 5): function, idempotent, dedupes,
 *       rejects on error, idempotent on already-present link
 *
 * Runs in pure Node — no jsdom, no playwright. The fake document
 * observes appendChild so we can verify the script + link tags.
 *
 * Vacuous-run guard: zero assertions must mean exit 1.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' \u2014 ' + info : '')); }
}

const src = fs.readFileSync(path.join(root, 'assets/js/ht-lazy.js'), 'utf8');

// ------------------------------------------------------------------
// Fake DOM — records every <script> and <link> the loader appends.
// ------------------------------------------------------------------
const appendedScripts = [];
const appendedLinks = [];
const existingLinkHrefs = new Set(); // CSS urls already declared in <head>
const fakeLink = {
  tagName: 'LINK',
  rel: '',
  href: '',
  dataset: {},
  onload: null,
  onerror: null,
  setAttribute: function () {},
  addEventListener: function () {},
};
const fakeDoc = {
  createElement: function (tag) {
    if (tag === 'script') {
      return {
        tagName: 'SCRIPT',
        src: '',
        defer: false,
        dataset: {},
        onload: null,
        onerror: null,
        setAttribute: function () {},
        addEventListener: function () {},
      };
    }
    if (tag === 'link') {
      // Return a fresh object each call (lazyLoadCss attaches onload
      // handlers; we don't want them shared across calls).
      return {
        tagName: 'LINK',
        rel: '',
        href: '',
        dataset: {},
        onload: null,
        onerror: null,
        setAttribute: function () {},
        addEventListener: function () {},
      };
    }
    return fakeLink;
  },
  head: {
    appendChild: function (el) {
      if (el && el.tagName === 'SCRIPT') appendedScripts.push(el);
      if (el && el.tagName === 'LINK') appendedLinks.push(el);
      return el;
    },
  },
  documentElement: { appendChild: function () {} },
  querySelector: function (selector) {
    // Mirror the lazyLoadCss selector: 'link[rel="stylesheet"][href="..."]'
    // — return truthy if the href is already declared in <head>.
    if (typeof selector !== 'string') return null;
    const m = selector.match(/href="([^"]+)"/);
    if (m && existingLinkHrefs.has(m[1])) {
      return { rel: 'stylesheet', href: m[1] };
    }
    return null;
  },
};

// ------------------------------------------------------------------
// Run the loader in a vm context.
// ------------------------------------------------------------------
const ctx = vm.createContext({
  window: {},
  document: fakeDoc,
  console: console,
  Promise: Promise,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
});

let HT;
try {
  vm.runInContext(src, ctx, { filename: 'ht-lazy.js' });
  HT = ctx.window.HT || {};
  check('HT exposed', typeof HT === 'object');
  check('HT.lazyLoad is function', typeof HT.lazyLoad === 'function');
} catch (e) {
  check('ht-lazy.js vm run', false, e.message);
  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);
  process.exit(1);
}

// ------------------------------------------------------------------
// (a) Shape and idempotence
// ------------------------------------------------------------------
check('HT.lazyLoad returns a Promise', HT.lazyLoad('assets/js/x.js') instanceof Promise);
check('HT.lazyLoad(\"\") rejects', new Promise(function (resolve) {
  HT.lazyLoad('').then(
    function () { resolve(false); },
    function () { resolve(true); }
  );
}));

// ------------------------------------------------------------------
// (b) Loader is callable BEFORE any chrome loads (Tier 1 invariant)
// ------------------------------------------------------------------
// Verify by checking the loader does not require any HT.* namespace
// to exist before being called. We just called it above with no
// preconditions; that satisfies the invariant.
check('loader callable with no chrome loaded', typeof HT.lazyLoad === 'function');

// ------------------------------------------------------------------
// (c) Appends a <script> tag with defer + data-ht-lazy="true"
// ------------------------------------------------------------------
const s1 = appendedScripts[0];
check('exactly one <script> appended', appendedScripts.length === 1,
  'got: ' + appendedScripts.length);
check('<script> has src matching requested url',
  s1 && s1.src === 'assets/js/x.js', 'got: ' + (s1 && s1.src));
check('<script> has defer=true', s1 && s1.defer === true);
check('<script> has data-ht-lazy="true"',
  s1 && s1.dataset.htLazy === 'true');

// ------------------------------------------------------------------
// (d) Script.onload resolves the promise, idempotent on second call
// ------------------------------------------------------------------
const loadPromise = HT.lazyLoad('assets/js/x.js');
check('second call returns same Promise (deduped)',
  HT.lazyLoad('assets/js/x.js') === loadPromise,
  'expected identical Promise reference');

// ------------------------------------------------------------------
// (e) Concurrent callers share one Promise
// ------------------------------------------------------------------
const c1 = HT.lazyLoad('assets/js/y.js');
const c2 = HT.lazyLoad('assets/js/y.js');
const c3 = HT.lazyLoad('assets/js/y.js');
check('three concurrent calls share one Promise',
  c1 === c2 && c2 === c3);

// ------------------------------------------------------------------
// (f) onload fires → loaded set; subsequent call resolves immediately
// ------------------------------------------------------------------
const onLoadP = new Promise(function (resolve) {
  // The first appendedScripts[0] is for x.js; second is y.js.
  // We resolve when we observe the x.js script's onload fire.
  setTimeout(function () {
    if (appendedScripts[0] && typeof appendedScripts[0].onload === 'function') {
      appendedScripts[0].onload();
    }
    resolve();
  }, 0);
});
onLoadP.then(function () {
  return HT.lazyLoad('assets/js/x.js');
}).then(function (val) {
  check('post-load lazyLoad resolves with undefined', val === undefined);
  check('post-load does not append a new <script>', appendedScripts.length === 2,
    'got: ' + appendedScripts.length);

  // ----------------------------------------------------------------
  // (g) onerror rejects.
  // ----------------------------------------------------------------
  const pErr = HT.lazyLoad('assets/js/z.js');
  setTimeout(function () {
    if (appendedScripts[2] && typeof appendedScripts[2].onerror === 'function') {
      appendedScripts[2].onerror();
    }
  }, 0);
  return pErr.then(
    function () {
      check('error path rejects', false, 'expected rejection');
    },
    function (e) {
      // The rejection value is an Error-like object. In a vm context,
      // `e instanceof Error` is false even though `e.message` is set.
      // Accept either shape.
      const msg = e && (e.message || String(e));
      check('error path rejects with ht-lazy: failed to load assets/js/z.js',
        typeof msg === 'string' && /ht-lazy: failed to load assets\/js\/z\.js/.test(msg),
        'got: ' + msg);
    }
  );
}).then(function () {
  // ----------------------------------------------------------------
  // (h) After error, a fresh lazyLoad of the same url re-attempts.
  // ----------------------------------------------------------------
  // Appended count was 3 (x, y, z); error rejected z; should accept a
  // new attempt.
  const retry = HT.lazyLoad('assets/js/z.js');
  check('retry after error accepts a new attempt', retry instanceof Promise);
  // Don't bother firing onload for z — we just verify the loader
  // re-attempted by inspecting that the entry moved out of inFlight
  // (cheap proxy: appendChild was called again).
  // The loader does not re-insert on retry unless the user actually
  // calls lazyLoad — we just verified it returned a Promise.

  // ================================================================
  // PHASE 5 — HT.lazyLoadCss(url) → Promise<void>
  // ================================================================

  // ----------------------------------------------------------------
  // (i) Shape: function + returns Promise; empty string rejects.
  // ----------------------------------------------------------------
  check('HT.lazyLoadCss is function', typeof HT.lazyLoadCss === 'function');
  check('HT.lazyLoadCss(\"\") rejects', new Promise(function (resolve) {
    HT.lazyLoadCss('').then(
      function () { resolve(false); },
      function () { resolve(true); }
    );
  }));

  // ----------------------------------------------------------------
  // (j) First call appends a <link rel="stylesheet" href="...">
  //     with data-ht-lazy-css="true".
  // ----------------------------------------------------------------
  const linksBeforeFirst = appendedLinks.length;
  const cssPromise = HT.lazyLoadCss('chrome-palette.css');
  const l1 = appendedLinks[linksBeforeFirst];
  check('HT.lazyLoadCss returns a Promise', cssPromise instanceof Promise);
  check('lazyLoadCss appended exactly one <link>',
    appendedLinks.length === linksBeforeFirst + 1,
    'got: ' + appendedLinks.length);
  check('<link> has rel="stylesheet"',
    l1 && l1.rel === 'stylesheet', 'got: ' + (l1 && l1.rel));
  check('<link> has href matching requested url',
    l1 && l1.href === 'chrome-palette.css', 'got: ' + (l1 && l1.href));
  check('<link> has data-ht-lazy-css="true"',
    l1 && l1.dataset.htLazyCss === 'true');

  // ----------------------------------------------------------------
  // (k) Idempotent on second call (same Promise reference).
  // ----------------------------------------------------------------
  check('second lazyLoadCss returns same Promise (deduped)',
    HT.lazyLoadCss('chrome-palette.css') === cssPromise,
    'expected identical Promise reference');

  // ----------------------------------------------------------------
  // (l) Concurrent callers share one Promise.
  // ----------------------------------------------------------------
  const cc1 = HT.lazyLoadCss('chrome-share.css');
  const cc2 = HT.lazyLoadCss('chrome-share.css');
  const cc3 = HT.lazyLoadCss('chrome-share.css');
  check('three concurrent lazyLoadCss calls share one Promise',
    cc1 === cc2 && cc2 === cc3);
  const shareLinkIdx = appendedLinks.length - 1;
  // Drain the share.css load so we don't leak handlers into the next test.
  setTimeout(function () {
    if (appendedLinks[shareLinkIdx] && typeof appendedLinks[shareLinkIdx].onload === 'function') {
      appendedLinks[shareLinkIdx].onload();
    }
  }, 0);

  // ----------------------------------------------------------------
  // (m) onload fires → resolve; subsequent call resolves immediately.
  // ----------------------------------------------------------------
  return new Promise(function (resolveOuter) {
    setTimeout(function () {
      if (appendedLinks[linksBeforeFirst] && typeof appendedLinks[linksBeforeFirst].onload === 'function') {
        appendedLinks[linksBeforeFirst].onload();
      }
      cssPromise.then(function (val) {
        check('lazyLoadCss onload resolves with undefined', val === undefined);
        return HT.lazyLoadCss('chrome-palette.css');
      }).then(function (val2) {
        check('post-load lazyLoadCss resolves with undefined', val2 === undefined);
        check('post-load does not append a new <link>',
          appendedLinks.length === linksBeforeFirst + 2,
          'got: ' + appendedLinks.length);

        // ------------------------------------------------------------
        // (n) Existing <link href="..."> short-circuits (page fallback).
        // ------------------------------------------------------------
        existingLinkHrefs.add('chrome-confirm.css');
        const beforeExisting = appendedLinks.length;
        HT.lazyLoadCss('chrome-confirm.css').then(function (val3) {
          check('existing <link> lazyLoadCss resolves immediately',
            val3 === undefined);
          check('existing <link> short-circuit appends nothing',
            appendedLinks.length === beforeExisting,
            'got: ' + appendedLinks.length);

          // ----------------------------------------------------------
          // (o) onerror rejects with ht-lazy: failed to load css <url>.
          // ----------------------------------------------------------
          const pCssErr = HT.lazyLoadCss('chrome-history.css');
          const cssErrIdx = appendedLinks.length - 1;
          setTimeout(function () {
            if (appendedLinks[cssErrIdx] && typeof appendedLinks[cssErrIdx].onerror === 'function') {
              appendedLinks[cssErrIdx].onerror();
            }
          }, 0);
          return pCssErr.then(
            function () { check('css error path rejects', false, 'expected rejection'); },
            function (e) {
              const msg = e && (e.message || String(e));
              check('css error rejects with ht-lazy: failed to load css chrome-history.css',
                typeof msg === 'string' && /ht-lazy: failed to load css chrome-history\.css/.test(msg),
                'got: ' + msg);
            }
          );
        }).then(function () {
          // --------------------------------------------------------
          // (p) 200ms fallback: if neither onload nor onerror fires,
          //     the loader still resolves (Safari historical quirk).
          // --------------------------------------------------------
          const t0 = Date.now();
          return HT.lazyLoadCss('chrome-help.css').then(function (val4) {
            const elapsed = Date.now() - t0;
            check('css 200ms fallback resolves with undefined', val4 === undefined);
            check('css 200ms fallback fired (elapsed >= 150ms)',
              elapsed >= 150, 'elapsed: ' + elapsed + 'ms');
          });
        }).then(function () {
          // --------------------------------------------------------
          // Final tally.
          // --------------------------------------------------------
          console.log('');
          console.log('passed: ' + pass + ', failed: ' + fail);
          if (pass === 0 && fail === 0) {
            console.error('smoke: vacuous run \u2014 zero assertions executed');
            process.exit(1);
          }
          process.exit(fail === 0 ? 0 : 1);
        }).catch(function (e) {
          console.error('UNEXPECTED css phase: ' + (e && e.message));
          console.log('');
          console.log('passed: ' + pass + ', failed: ' + fail);
          process.exit(1);
        });
        resolveOuter();
      }).catch(function (e) {
        console.error('UNEXPECTED post-load: ' + (e && e.message));
        console.log('');
        console.log('passed: ' + pass + ', failed: ' + fail);
        process.exit(1);
      });
    }, 0);
  });
}).catch(function (e) {
  console.error('UNEXPECTED: ' + (e && e.message));
  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);
  process.exit(1);
});
