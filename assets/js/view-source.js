/* ============================================
   view-source.js — Story 3.11

   Local view-source route: /view-source?tool=<slug>

   Behavior:
   1. Parse ?tool=<slug> from location.search.
   2. Look up the slug in tools.json (loaded
      inline on the home page; on this page we
      fetch tools.json directly).
   3. Fetch tools/<slug>/index.html,
      tools/<slug>/<slug>.css, and
      tools/<slug>/<slug>.js.
   4. Pipe each through HT.highlight(code, lang)
      (best-effort; falls back to plain text).
   5. Wire Download ZIP button (HT.zipStore).
   6. Surface 404 with document.title='404 Not
      Found' when fetch fails.

   Public surface (frozen):
     HT.viewSource.mount()      — boot the route
     HT.viewSource.freezeState  — Object.freeze'd {files, slug}

   Story 3.11 — see
   _bmad-output/implementation-artifacts/3-11-...
   ============================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'handy-tools.viewSource.recent';
  var RECENT_CAP = 5;

  // -------------------------------------------------
  // Utilities
  // -------------------------------------------------

  function $(id) {
    return document.getElementById(id);
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function setStatus(text, kind) {
    var el = $('view-source-status');
    if (el) {
      el.textContent = text;
      el.dataset.kind = kind || 'ok';
    }
  }

  function showNotFound(message) {
    var sec = $('view-source-not-found');
    var msg = $('view-source-not-found-message');
    if (sec) sec.hidden = false;
    if (msg) msg.textContent = message || 'Tool not found.';
    document.title = '404 Not Found';
    setStatus('Tool not found', 'error');
    var dl = $('view-source-download');
    var cp = $('view-source-copy');
    if (dl) dl.disabled = true;
    if (cp) cp.disabled = true;
  }

  function getQuerySlug() {
    try {
      var params = new URLSearchParams(window.location.search);
      var s = params.get('tool');
      if (typeof s !== 'string') return null;
      s = s.trim();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  // -------------------------------------------------
  // tools.json fetch — try inline first, then fetch
  // -------------------------------------------------

  function fetchToolsJson() {
    return new Promise(function (resolve, reject) {
      var inline = document.getElementById('ht-tools-json-inline');
      if (inline && inline.textContent) {
        try {
          var parsed = JSON.parse(inline.textContent);
          if (Array.isArray(parsed)) return resolve(parsed);
        } catch (_) { /* fall through */ }
      }
      // Fallback: fetch from the repo root. Some
      // surfaces (the view-source page itself) don't
      // carry the inline manifest.
      try {
        fetch('tools.json', { credentials: 'same-origin' })
          .then(function (r) {
            if (!r.ok) return reject(new Error('tools.json HTTP ' + r.status));
            return r.json();
          })
          .then(function (j) {
            if (Array.isArray(j)) resolve(j);
            else reject(new Error('tools.json not an array'));
          })
          .catch(reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  function findToolEntry(entries, slug) {
    if (!Array.isArray(entries)) return null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && entries[i].slug === slug) return entries[i];
    }
    return null;
  }

  // -------------------------------------------------
  // Source fetches
  // -------------------------------------------------

  function fetchSource(path) {
    return fetch(path, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) {
        var e = new Error('HTTP ' + r.status + ' on ' + path);
        e.status = r.status;
        throw e;
      }
      return r.text();
    });
  }

  function fetchAll(slug) {
    var base = 'tools/' + slug + '/';
    var paths = [
      { lang: 'html', path: base + 'index.html', key: 'html' },
      { lang: 'css',  path: base + slug + '.css', key: 'css' },
      { lang: 'js',   path: base + slug + '.js',  key: 'js' }
    ];
    return Promise.all(paths.map(function (p) {
      return fetchSource(p.path).then(
        function (text) { return { lang: p.lang, path: p.path, text: text, ok: true }; },
        function (err) { return { lang: p.lang, path: p.path, text: '', ok: false, err: err }; }
      );
    })).then(function (results) {
      // If any of the three fetches failed, treat the whole
      // tool as not-found rather than showing partial source.
      for (var i = 0; i < results.length; i++) {
        if (!results[i].ok) {
          var e = new Error('Failed to fetch ' + results[i].path);
          e.results = results;
          throw e;
        }
      }
      return results;
    });
  }

  // -------------------------------------------------
  // Render
  // -------------------------------------------------

  function renderCode(target, source, lang) {
    if (!target) return;
    target.textContent = ''; // clear
    var highlighter = (window.HT && typeof window.HT.highlight === 'function')
      ? window.HT.highlight
      : null;
    if (highlighter) {
      try {
        target.appendChild(highlighter(source, lang));
        return;
      } catch (e) {
        // fall through to plain text
      }
    }
    target.textContent = source;
  }

  function renderAll(results) {
    var byKey = {};
    results.forEach(function (r) { byKey[r.lang] = r; });

    var htmlEl = $('view-source-html');
    var cssEl = $('view-source-css');
    var jsEl = $('view-source-js');

    setText($('view-source-html-path'), byKey.html.path);
    setText($('view-source-css-path'), byKey.css.path);
    setText($('view-source-js-path'), byKey.js.path);

    renderCode(htmlEl, byKey.html.text, 'html');
    renderCode(cssEl,  byKey.css.text,  'css');
    renderCode(jsEl,   byKey.js.text,   'js');

    return byKey;
  }

  // -------------------------------------------------
  // Download (ZIP)
  // -------------------------------------------------

  function wireDownload(slug, files) {
    var btn = $('view-source-download');
    if (!btn) return;
    btn.disabled = false;
    btn.addEventListener('click', function () {
      try {
        var zip = (window.HT && typeof window.HT.zipStore === 'function')
          ? window.HT.zipStore(files)
          : null;
        if (!zip) {
          setStatus('ZIP builder unavailable', 'error');
          return;
        }
        var blob = new Blob([zip], { type: 'application/zip' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = slug + '-source.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        setStatus('Downloaded ' + slug + '-source.zip', 'ok');
      } catch (e) {
        setStatus('Download failed: ' + (e && e.message || 'unknown'), 'error');
      }
    });
  }

  function wireCopy(slug) {
    var btn = $('view-source-copy');
    if (!btn) return;
    btn.disabled = false;
    btn.addEventListener('click', function () {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(window.location.href).then(function () {
            setStatus('URL copied', 'ok');
          }, function () {
            setStatus('Copy failed', 'error');
          });
        } else {
          // Legacy fallback for file:// + old browsers
          var ta = document.createElement('textarea');
          ta.value = window.location.href;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try {
            document.execCommand('copy');
            setStatus('URL copied', 'ok');
          } catch (_) {
            setStatus('Copy failed', 'error');
          }
          document.body.removeChild(ta);
        }
      } catch (_) {
        setStatus('Copy failed', 'error');
      }
    });
  }

  // -------------------------------------------------
  // Recent tracking (UX-DR-11)
  // -------------------------------------------------

  function pushRecent(slug) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var arr = [];
      try { arr = raw ? JSON.parse(raw) : []; } catch (_) { arr = []; }
      if (!Array.isArray(arr)) arr = [];
      // Dedupe (FIFO)
      arr = arr.filter(function (s) { return s !== slug; });
      arr.push(slug);
      // Cap at RECENT_CAP distinct entries
      if (arr.length > RECENT_CAP) arr = arr.slice(arr.length - RECENT_CAP);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (_) { /* ignore quota errors */ }
  }

  // -------------------------------------------------
  // Boot
  // -------------------------------------------------

  function boot() {
    var slug = getQuerySlug();
    var main = document.getElementById('main');
    if (main) main.dataset.viewSourceTool = slug || '';

    if (!slug) {
      // No slug — show a friendly message rather than 404.
      document.title = 'View source · Handy Tools';
      setStatus('Open this page with ?tool=<slug> (e.g. ?tool=qr-code-generator).', 'info');
      var dl0 = $('view-source-download');
      var cp0 = $('view-source-copy');
      if (dl0) dl0.disabled = true;
      if (cp0) cp0.disabled = true;
      return;
    }

    setStatus('Loading ' + slug + '…', 'info');

    fetchToolsJson().then(function (entries) {
      var entry = findToolEntry(entries, slug);
      if (!entry) {
        showNotFound('Tool "' + slug + '" not found');
        return;
      }
      if (entry['view-source'] && entry['view-source'].enabled === false) {
        showNotFound('Tool "' + slug + '" has view-source disabled');
        return;
      }
      return fetchAll(slug).then(function (results) {
        document.title = slug + ' · view source · Handy Tools';
        var files = renderAll(results);
        wireDownload(slug, [
          { name: slug + '.css', data: files.css.text },
          { name: slug + '.js',  data: files.js.text  },
          { name: 'index.html',  data: files.html.text }
        ]);
        wireCopy(slug);
        setStatus('Loaded ' + slug, 'ok');
        pushRecent(slug);
      });
    }).catch(function (err) {
      showNotFound('Tool "' + slug + '" not found (' + (err && err.message || 'fetch failed') + ')');
    });
  }

  // -------------------------------------------------
  // Public API (frozen)
  // -------------------------------------------------

  var viewSource = {
    boot: boot,
    fetchAll: fetchAll,
    getQuerySlug: getQuerySlug,
    // For tests only — internal state holder.
    _internal: Object.freeze({
      STORAGE_KEY: STORAGE_KEY,
      RECENT_CAP: RECENT_CAP
    })
  };

  window.HT = window.HT || {};
  window.HT.viewSource = Object.freeze(viewSource);

  // -------------------------------------------------
  // Auto-boot on DOMContentLoaded (or immediately
  // if the doc is already past loading).
  // -------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();