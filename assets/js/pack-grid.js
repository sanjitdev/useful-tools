/* ============================================
   Handy Tools — pack-grid.js
   Renders the "Browse by Pack" section on the home page.

   Data flow:
     1. fetch('./tools.json') — preferred path (production + dev).
     2. Fallback: <script type="application/json" id="ht-tools-json-inline">
        inlined by scripts/shell-template.py for file:// loads where fetch
        throws a CORS/scheme error.

   Public API (AD-14): HT.packGrid = { render, packs, ready, version }.

   Boundaries:
     - Only reads via fetch + document.querySelector. No localStorage,
       no HT.provide, no shell API consumption. (AD-13 / AD-14.)
     - The script tag is included on the home page; the renderer early-returns
       unless the host element is present in the DOM.
     - Embed mode (?embed=1): early-returns without mounting.

   Idempotency:
     - render() checks the host element's data-mounted attribute; the
       API object is frozen once after the first successful render and
       re-frozen on every subsequent successful mount so the public
       snapshot reflects the latest data.

   Pack taxonomy:
     - 5 packs pinned by tools.schema.json pack.items.enum:
         travel, finance, study, developer, household
     - Pack taglines per EXPERIENCE.md §2.3.
     - Empty packs (no in-pack ready tools) are not rendered.
   ============================================ */

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const HOST_ID = 'home-grid-packs';
  const SECTION_ID = 'home-grid-packs-section';
  const INLINE_ID = 'ht-tools-json-inline';
  const TOOLS_JSON_URL = './tools.json';

  // 5 pack descriptors. Taglines per EXPERIENCE.md §2.3.
  // Icons are inline SVGs (currentColor stroke/fill, sized to 24×24).
  const PACK_DEFINITIONS = [
    {
      slug: 'travel',
      title: 'Travel',
      description: 'Split bills, convert currencies, scale recipes abroad, handle time zones.',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16v-2l-9-5V5a1.5 1.5 0 0 0-3 0v4l-9 5v2l9-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L12 19v-5.5z"/></svg>'
    },
    {
      slug: 'finance',
      title: 'Finance',
      description: 'For the numbers behind a decision.',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/></svg>'
    },
    {
      slug: 'study',
      title: 'Study',
      description: 'For essays, notes, exams.',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 4v12a4 4 0 0 0 4 4"/><path d="M9 8h6M9 12h6"/></svg>'
    },
    {
      slug: 'developer',
      title: 'Developer',
      description: "For the bits that don't need a SaaS subscription.",
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/></svg>'
    },
    {
      slug: 'household',
      title: 'Household',
      description: 'For the math of daily life.',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>'
    },
    {
      slug: 'fun',
      title: 'Fun',
      description: 'For breaks, decisions, and color.',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.4 5.6L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.4z"/></svg>'
    }
  ];

  // Defense-in-depth shape check — CI validates the schema upstream.
  // The renderer only enforces the minimum fields it reads.
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

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function readInline() {
    const node = document.getElementById(INLINE_ID);
    if (!node) return null;
    const text = node.textContent;
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('pack-grid: inline JSON malformed', err);
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
        console.warn(
          'pack-grid: tools.json unreachable, hiding section',
          fetchErr
        );
        return null;
      }
      return inline;
    });
  }

  function groupByPack(entries) {
    // Preserves PACK_DEFINITIONS order (travel, finance, study, developer,
    // household). A pack is rendered iff at least one ready tool lists it.
    const toolsByPack = Object.create(null);
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!isValidEntry(entry) || entry.ready !== true) continue;
      for (let j = 0; j < entry.pack.length; j += 1) {
        const slug = entry.pack[j];
        if (!toolsByPack[slug]) toolsByPack[slug] = [];
        toolsByPack[slug].push({ slug: entry.slug, title: entry.title });
      }
    }
    const out = [];
    for (let i = 0; i < PACK_DEFINITIONS.length; i += 1) {
      const def = PACK_DEFINITIONS[i];
      const tools = toolsByPack[def.slug];
      if (!tools || tools.length === 0) continue; // skip empty packs
      out.push({
        slug: def.slug,
        title: def.title,
        description: def.description,
        icon: def.icon,
        toolCount: tools.length,
        tools: tools
      });
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

  function buildPackCard(pack) {
    const labelSuffix = pack.toolCount === 1 ? ' tool' : ' tools';
    return (
      '<a class="pack-card" href="/packs/' +
      escapeAttr(pack.slug) +
      '.html" data-pack-slug="' +
      escapeAttr(pack.slug) +
      '" data-pack-count="' +
      String(pack.toolCount) +
      '">' +
      '<span class="pack-card-icon">' +
      pack.icon +
      '</span>' +
      '<span class="pack-card-body">' +
      '<span class="pack-card-title">' +
      escapeAttr(pack.title) +
      '</span>' +
      '<span class="pack-card-desc">' +
      escapeAttr(pack.description || '') +
      '</span>' +
      '<span class="pack-card-count">' +
      String(pack.toolCount) +
      labelSuffix +
      '</span>' +
      '</span>' +
      '</a>'
    );
  }

  function mount(data) {
    const host = document.getElementById(HOST_ID);
    const section = document.getElementById(SECTION_ID);
    if (!host || !section) return;

    // Replace any prior render — render() is idempotent across re-fetches.
    while (host.firstChild) host.removeChild(host.firstChild);

    if (!data || !Array.isArray(data.tools)) {
      section.setAttribute('hidden', '');
      host.setAttribute('data-mounted', 'false');
      return;
    }

    const packs = groupByPack(data.tools);
    if (packs.length === 0) {
      section.setAttribute('hidden', '');
      host.setAttribute('data-mounted', 'false');
      return;
    }

    host.innerHTML = packs.map(buildPackCard).join('');
    section.removeAttribute('hidden');
    host.setAttribute('data-mounted', 'true');
  }

  // Live snapshot used to populate HT.packGrid.packs. Updated on every
  // successful mount; stays null until the first successful fetch.
  let livePacks = null;

  function publishApi() {
    window.HT = window.HT || {};
    window.HT.packGrid = Object.freeze({
      render: render,
      packs: livePacks,
      ready: Boolean(livePacks),
      version: VERSION
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    return loadTools().then(function (data) {
      if (data && Array.isArray(data.tools)) {
        livePacks = groupByPack(data.tools);
      } else {
        livePacks = null;
      }
      mount(data);
      publishApi();
      return data;
    });
  }

  function boot() {
    if (window.HT && window.HT.packGrid && window.HT.packGrid.version) {
      // Another script (HMR, duplicate include) already installed the API;
      // skip rather than clobber.
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
