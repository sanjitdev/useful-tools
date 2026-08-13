/* ============================================
   Handy Tools — pack-page.js
   Renders /packs/<slug>.html pages. Each page mounts the pack header
   (icon + title + tagline + tool count) and a tool grid filtered by
   `entry.ready === true && entry.pack.includes(slug)`.

   Data flow:
     1. fetch('../tools.json') — preferred path (production + dev).
     2. Fallback: <script type="application/json" id="ht-tools-json-inline">
        inlined by scripts/shell-template.py for file:// loads.

   Public API (AD-14): HT.packPage = { render, packs, ready, version }.

   Boundaries:
     - Only reads via fetch + document.querySelector. No localStorage,
       no HT.provide, no shell API consumption. (AD-13 / AD-14.)
     - The script tag is included on every pack page; the renderer early-returns
       unless the host elements are present in the DOM.
     - Embed mode (?embed=1): early-returns without mounting.

   Idempotency:
     - render() checks the host element's data-mounted attribute; the
       API object is frozen once after the first successful render and
       re-frozen on every subsequent successful mount.

   Pack taxonomy:
     - 5 packs pinned by tools.schema.json pack.items.enum.
     - Slug derived from window.location.pathname (/packs/<slug>.html)
       or from the data-pack-slug attribute on the host element.
   ============================================ */

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const TOOLS_JSON_URL = '../tools.json';
  const INLINE_ID = 'ht-tools-json-inline';
  const PACK_SLUGS = ['travel', 'finance', 'study', 'developer', 'household', 'fun'];

  // 6 pack descriptors — taglines per EXPERIENCE.md §2.3. Duplicated from
  // assets/js/pack-grid.js (intentional, see Story 6.2 Dev Notes).
  const PACK_DEFINITIONS = {
    travel: {
      title: 'Travel',
      tagline: 'For the road, the flight, the family trip.'
    },
    finance: {
      title: 'Finance',
      tagline: 'For the numbers behind a decision.'
    },
    study: {
      title: 'Study',
      tagline: 'For essays, notes, exams.'
    },
    developer: {
      title: 'Developer',
      tagline: "For the bits that don't need a SaaS subscription."
    },
    household: {
      title: 'Household',
      tagline: 'For the math of daily life.'
    },
    fun: {
      title: 'Fun',
      tagline: 'For breaks, decisions, and color.'
    }
  };

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function resolvePackSlug() {
    // 1. data-pack-slug attribute on the host (set by generate-pack-pages.py)
    const header = document.querySelector('.pack-page-header');
    if (header && header.getAttribute('data-pack-slug')) {
      return header.getAttribute('data-pack-slug');
    }
    // 2. window.location.pathname: /packs/<slug>.html or /packs/<slug>/
    try {
      const path = window.location.pathname || '';
      const match = path.match(/\/packs\/([a-z][a-z0-9-]*)(?:\.html|\/|$)/);
      if (match) return match[1];
    } catch (_) {
      // ignore
    }
    return null;
  }

  function readInline() {
    const node = document.getElementById(INLINE_ID);
    if (!node) return null;
    const text = node.textContent;
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('pack-page: inline JSON malformed', err);
      return null;
    }
  }

  function fetchToolsJson() {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('fetch unavailable'));
    }
    return fetch(TOOLS_JSON_URL, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    });
  }

  function loadTools() {
    return fetchToolsJson().catch(function (fetchErr) {
      const inline = readInline();
      if (!inline) {
        console.warn('pack-page: tools.json unreachable', fetchErr);
        return null;
      }
      return inline;
    });
  }

  function isValidEntry(entry) {
    return (
      entry &&
      typeof entry === 'object' &&
      typeof entry.slug === 'string' &&
      entry.slug.length > 0 &&
      typeof entry.title === 'string' &&
      entry.title.length > 0 &&
      Array.isArray(entry.pack)
    );
  }

  function filterForPack(entries, slug) {
    const out = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!isValidEntry(entry) || entry.ready !== true) continue;
      if (entry.pack.indexOf(slug) === -1) continue;
      out.push(entry);
    }
    return out;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildIconImg(iconSrc) {
    // Pack pages live at /packs/<slug>.html, one level deep. Icon paths in
    // tools.json are stored relative to the repo root ("assets/icons/..."),
    // so we prefix "../" to resolve correctly from a depth-1 page.
    const src = (typeof iconSrc === 'string' && iconSrc.charAt(0) !== '/')
      ? '../' + iconSrc
      : iconSrc;
    return (
      '<span class="tool-card-icon"><img alt="" src="' +
      escapeAttr(src) +
      '" /></span>'
    );
  }

  function buildCard(entry) {
    return (
      '<a class="tool-card" href="../tools/' +
      escapeAttr(entry.slug) +
      '/index.html">' +
      buildIconImg(entry.icon) +
      '<span class="tool-card-title">' +
      escapeAttr(entry.title) +
      '</span>' +
      '<span class="tool-card-desc">' +
      escapeAttr(entry.description || '') +
      '</span>' +
      '</a>'
    );
  }

  function buildEmptyState() {
    return (
      '<div class="tool-card tool-card--empty" role="note" aria-label="No tools in this pack yet">' +
      '<span class="tool-card-title">No tools in this pack yet</span>' +
      '<span class="tool-card-desc">Check back soon — pack pages populate as tools reach the 8/10 quality bar.</span>' +
      '</div>'
    );
  }

  function mountPackHeader(pack) {
    const titleEl = document.getElementById('pack-page-title');
    const taglineEl = document.getElementById('pack-page-tagline');
    const countEl = document.getElementById('pack-page-count');
    if (titleEl) titleEl.textContent = pack.title;
    if (taglineEl) taglineEl.textContent = pack.tagline;
    if (countEl) {
      const label = pack.toolCount === 1 ? ' tool' : ' tools';
      countEl.textContent = pack.toolCount + label;
    }
  }

  function mount(pack) {
    const toolsHost = document.getElementById('pack-page-tool-grid');
    const toolsSection = document.getElementById('pack-page-tools');
    if (!toolsHost || !toolsSection) return;

    // Replace any prior render — render() is idempotent across re-fetches.
    while (toolsHost.firstChild) toolsHost.removeChild(toolsHost.firstChild);

    mountPackHeader(pack);

    if (pack.tools.length === 0) {
      toolsHost.innerHTML = buildEmptyState();
    } else {
      toolsHost.innerHTML = pack.tools.map(buildCard).join('');
    }
    toolsSection.setAttribute('data-mounted', 'true');
  }

  // Live snapshot used to populate HT.packPage.packs.
  let livePack = null;

  function publishApi() {
    window.HT = window.HT || {};
    window.HT.packPage = Object.freeze({
      render: render,
      packs: livePack,
      ready: Boolean(livePack),
      version: VERSION
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    const slug = resolvePackSlug();
    if (!slug || PACK_SLUGS.indexOf(slug) === -1) {
      console.warn('pack-page: unknown pack slug', slug);
      livePack = null;
      publishApi();
      return Promise.resolve(null);
    }

    const def = PACK_DEFINITIONS[slug];

    return loadTools().then(function (data) {
      if (!data || !Array.isArray(data.tools)) {
        livePack = {
          slug: slug,
          title: def.title,
          tagline: def.tagline,
          toolCount: 0,
          tools: []
        };
        mount(livePack);
        publishApi();
        return data;
      }
      const tools = filterForPack(data.tools, slug);
      livePack = {
        slug: slug,
        title: def.title,
        tagline: def.tagline,
        toolCount: tools.length,
        tools: tools
      };
      mount(livePack);
      publishApi();
      return data;
    });
  }

  function boot() {
    if (window.HT && window.HT.packPage && window.HT.packPage.version) {
      return;
    }
    publishApi();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();