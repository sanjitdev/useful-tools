/* ============================================
   Handy Tools — quality.js
   Renders the /quality inventory table from tools.json + the rubric doc.

   Data flow:
     1. fetch('./tools.json')                     → tool entries (slug, score, last-updated, ready, score-waiver)
     2. fetch('./docs/quality-rubric.md')         → 10 criteria + one-line Remediation lines
     3. Both fetches succeed → render the table
     4. Either fetch fails   → render inline error + Retry button

   Render contract (AD-11 — Trust Surface):
     `/quality` is generated from tools.json on every page load. quality.html
     contains zero inline <tr> rows for any specific tool slug; the table body
     is empty until this script runs. The "audit" column is the per-tool
     `last-updated` from tools.json (per AC-4 of Story 2.11), not the global
     audit run timestamp.

   Boundaries:
     - Reads: window.HT (qs/qsa from utils.js), fetch, document.
     - Writes: <table id="ht-quality-table"> thead row appends + tbody rows,
       section <div id="ht-quality-rubric-list"> for the rubric summary, and
       <p id="ht-quality-meta"> for the "Generated" sub-line.
     - No localStorage. No HT.provide / HT.use. No shell API consumption.
     - Embed mode (?embed=1): early-returns without mounting.

   Idempotency:
     - render() checks the host's data-mounted attribute; repeated calls
       replace the rendered rows. The HT.quality public surface is frozen
       once after the first successful render.
   ============================================ */

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const TOOLS_JSON_URL = './tools.json';
  const RUBRIC_URL = './docs/quality-rubric.md';
  const TABLE_ID = 'ht-quality-table';
  const TBODY_ID = 'ht-quality-tbody';
  const THEAD_ROW_ID = 'ht-quality-thead-row';
  const RUBRIC_LIST_ID = 'ht-quality-rubric-list';
  const META_ID = 'ht-quality-meta';
  const ERROR_ID = 'ht-quality-table-error';

  // ---------- helpers ----------

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatIsoDate(iso) {
    // ISO timestamps from tools.json are UTC (trailing 'Z'). We drop the
    // time component for the "Last audit" column. The rubric doc (AC-4)
    // mandates YYYY-MM-DD format. Using toISOString() on a parsed Date is
    // timezone-stable because the input is UTC. If the input is missing
    // the trailing 'Z' and also has no explicit offset, fall back to
    // empty string — the parser would otherwise interpret it as local
    // time and shift the date by one day in non-UTC zones.
    if (typeof iso !== 'string' || iso.length === 0) return '';
    if (!/Z$/.test(iso) && !/[+-]\d{2}:\d{2}$/.test(iso)) return '';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  }

  function formatGenerated(iso) {
    // The top-level `generated` field is the audit-run timestamp. We surface
    // YYYY-MM-DD HH:MM:SS UTC. Falls back to the raw string if Date parsing
    // fails (shouldn't happen since audit scripts emit ISO 8601).
    if (typeof iso !== 'string' || iso.length === 0) return '';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return parsed.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }

  // ---------- rubric extraction ----------

  // The rubric doc has 10 ### N. <name> blocks. Each block contains a table
  // whose "Remediation" row carries a quoted one-line hint. We extract the
  // full block text per criterion, then pull the Remediation line out of the
  // table. This is intentionally permissive — the rubric is the source of
  // truth, and the regex tolerates the prose paragraph + the table layout.
  const RUBRIC_HEADING_RE = /^### (\d+)\.\s+([^\n]+)\s*$/gm;

  function parseRubric(markdown) {
    const criteria = [];
    if (typeof markdown !== 'string' || markdown.length === 0) return criteria;

    // Strip a leading UTF-8 BOM if present (some editors / build steps
    // emit it). Without this, the heading regex won't match and the
    // rubric yields 0 criteria.
    if (markdown.charCodeAt(0) === 0xFEFF) markdown = markdown.slice(1);

    // Find all headings and capture their slice ranges.
    const headings = [];
    let match;
    while ((match = RUBRIC_HEADING_RE.exec(markdown)) !== null) {
      headings.push({
        index: match.index,
        num: parseInt(match[1], 10),
        name: match[2].trim(),
        headerEnd: match.index + match[0].length,
      });
    }
    if (headings.length === 0) return criteria;

    // Deduplicate by `num` — duplicates produce duplicated thead column
    // IDs (id="ht-quality-col-cN") which violates the HTML spec and
    // makes getElementById ambiguous.
    const seenNums = new Set();
    const unique = [];
    for (let i = 0; i < headings.length; i += 1) {
      const h = headings[i];
      if (seenNums.has(h.num)) continue;
      seenNums.add(h.num);
      unique.push(h);
    }

    // Slice the block under each heading (until the next heading or EOF).
    for (let i = 0; i < unique.length; i += 1) {
      const h = unique[i];
      const next = unique[i + 1];
      const blockEnd = next ? next.index : markdown.length;
      const block = markdown.slice(h.headerEnd, blockEnd);

      // Pull the Remediation line. The doc formats it inside a table row as
      //   | Remediation | "<text>" |
      // We accept the first such quoted hint in the block. Accepts either
      // double or single quotes so the rubric doc doesn't need to rigidly
      // format. If the rubric wraps onto multiple lines, the trailing
      // matching quote is the terminator.
      const remIdx = block.indexOf('Remediation');
      let remediation = '';
      if (remIdx !== -1) {
        const after = block.slice(remIdx);
        const quoteChar = after.indexOf('"') !== -1 ? '"'
          : after.indexOf("'") !== -1 ? "'" : '';
        if (quoteChar) {
          const quoteStart = after.indexOf(quoteChar);
          const quoteEnd = after.indexOf(quoteChar, quoteStart + 1);
          if (quoteEnd !== -1) {
            remediation = after.slice(quoteStart + 1, quoteEnd).trim();
          }
        }
      }

      criteria.push({
        num: h.num,
        name: h.name,
        remediation: remediation,
      });
    }

    // Sort by number so out-of-order headings still produce a stable order.
    criteria.sort(function (a, b) {
      return a.num - b.num;
    });
    return criteria;
  }

  // ---------- per-tool criterion status ----------

  // Tools ship at score ≥ 8 OR with a score-waiver. The 10-criterion matrix
  // is the per-tool granular status for each criterion (PASS/FAIL/WARN/MANUAL).
  // tools.json only carries the aggregate score, not per-criterion status.
  // Until the audit doc exposes per-criterion status via a parseable signal,
  // we render the matrix as PASS for the count === score, and MANUAL for the
  // uninspected remainder — both labelled as "Awaiting audit" via the cell
  // title attribute. This is the conservative default: never claim a
  // criterion is FAIL when we haven't audited it. The colors stay green for
  // the verified PASS; the rest get the MANUAL (gray) shade.
  //
  // Story 5.8 will swap this fallback for the real audit doc's per-criterion
  // PASS/WARN/FAIL/MANUAL statuses.
  function buildCriterionStatusMap(tool) {
    // Clamp score to [0, 10] so a tool with score > 10 doesn't render
    // all 10 cells PASS regardless of rubric max. The 10-criterion matrix
    // is the per-tool granular status for each criterion (PASS/FAIL/WARN/
    // MANUAL). tools.json only carries the aggregate score, not per-
    // criterion status. Until the audit doc exposes per-criterion status
    // via a parseable signal, we render the matrix as PASS for the count
    // === score, and MANUAL for the uninspected remainder — both labelled
    // as "Awaiting audit" via the cell title attribute. Story 5.8 will
    // swap this fallback for the real audit doc's per-criterion
    // PASS/WARN/FAIL/MANUAL statuses.
    const raw = typeof tool.score === 'number' && tool.score >= 0 ? tool.score : 0;
    const score = Math.min(10, Math.max(0, raw));
    const map = [];
    for (let i = 1; i <= 10; i += 1) {
      let status = 'MANUAL';
      if (i <= score) {
        status = 'PASS';
      }
      map.push({ num: i, status: status });
    }
    return map;
  }

  // ---------- fetch wrappers (HT.fetch — see assets/js/utils.js) ----------

  function fetchJson(url) {
    return window.HT && typeof window.HT.fetch === 'function'
      ? window.HT.fetch(url, { type: 'json' })
      : Promise.reject(new Error('HT.fetch unavailable'));
  }

  function fetchText(url) {
    return window.HT && typeof window.HT.fetch === 'function'
      ? window.HT.fetch(url, { type: 'text' })
      : Promise.reject(new Error('HT.fetch unavailable'));
  }

  // ---------- header columns ----------

  function appendCriterionColumns(criteria) {
    const theadRow = HT.qs('#' + THEAD_ROW_ID);
    if (!theadRow) return;
    // Idempotent: if a previous render already appended the 10 criterion
    // columns, do nothing. Prevents duplicate `<th>` cells + duplicate IDs
    // when the Retry button triggers a second render() pass.
    if (theadRow.children.length > 5) return;
    for (let i = 0; i < criteria.length; i += 1) {
      const c = criteria[i];
      const th = document.createElement('th');
      th.scope = 'col';
      th.id = 'ht-quality-col-c' + c.num;
      th.className = 'ht-quality-col-criterion';
      th.setAttribute('data-criterion', String(c.num));
      th.setAttribute('title', c.name);
      // Compact abbr for screen readers — the full name is in the title attr
      // and in the rubric summary section above.
      th.setAttribute('abbr', c.name);
      // Header is a link to the criterion's anchor in the rubric summary.
      // The summary accordions live above the table; AC-6 anchors are
      // `#c1`–`#c10`.
      const a = document.createElement('a');
      a.href = '#c' + c.num;
      a.textContent = 'C' + c.num;
      a.className = 'ht-quality-col-link';
      a.setAttribute('aria-label', 'Criterion ' + c.num + ' — ' + c.name);
      th.appendChild(a);
      theadRow.appendChild(th);
    }
  }

  // ---------- per-row render ----------

  function pickBarIcon(tool) {
    const score = typeof tool.score === 'number' ? tool.score : 0;
    const hasWaiver = tool && tool['score-waiver'] && score < 8;
    if (score >= 8) {
      return { icon: '✅', label: 'Bar: pass', status: 'GREEN' };
    }
    if (hasWaiver) {
      return { icon: '⚠️', label: 'Bar: waiver in effect', status: 'WAIVER' };
    }
    return { icon: '❌', label: 'Bar: fail', status: 'FAIL' };
  }

  function pickScoreColor(score, hasWaiver) {
    if (typeof score !== 'number') return 'rgba(148, 163, 184, 0.4)';
    if (score >= 8) return 'rgba(34, 197, 94, 0.25)';
    if (hasWaiver) return 'rgba(234, 179, 8, 0.22)';
    return 'rgba(239, 68, 68, 0.22)';
  }

  function buildRow(tool, criteria) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-ht-tool', tool.slug);
    tr.className = 'ht-quality-score-row';

    const score = typeof tool.score === 'number' ? tool.score : 0;
    const hasWaiver = Boolean(tool['score-waiver']);
    const isBelowBar = score < 8;
    if (isBelowBar) {
      tr.classList.add('row-below-bar');
    }
    if (hasWaiver) {
      tr.classList.add('row-waiver');
    }

    // 1. Tool name (linked to the tool's index.html)
    const tdTool = document.createElement('td');
    tdTool.className = 'ht-quality-cell-tool';
    const toolLink = document.createElement('a');
    toolLink.href = 'tools/' + encodeURIComponent(tool.slug) + '/index.html';
    toolLink.textContent = tool.title || tool.slug;
    toolLink.setAttribute('data-ht-tool-link', tool.slug);
    tdTool.appendChild(toolLink);
    tr.appendChild(tdTool);

    // 2. Slug (monospaced)
    const tdSlug = document.createElement('td');
    tdSlug.className = 'ht-quality-cell-slug';
    const slugCode = document.createElement('code');
    slugCode.textContent = tool.slug;
    tdSlug.appendChild(slugCode);
    tr.appendChild(tdSlug);

    // 3. Score (integer, colour-coded)
    const tdScore = document.createElement('td');
    tdScore.className = 'ht-quality-cell-score';
    tdScore.textContent = String(score);
    tdScore.style.backgroundColor = pickScoreColor(score, hasWaiver);
    if (hasWaiver) {
      tdScore.title = 'Score ' + score + ' (waiver active; see Bar column)';
    } else {
      tdScore.title = 'Score ' + score + ' / 10';
    }
    tr.appendChild(tdScore);

    // 4. Last audit (per-tool last-updated, YYYY-MM-DD)
    const tdAudit = document.createElement('td');
    tdAudit.className = 'ht-quality-cell-audit';
    tdAudit.textContent = formatIsoDate(tool['last-updated']);
    if (tool['last-updated']) {
      tdAudit.title = 'Last audit: ' + tool['last-updated'];
    }
    tr.appendChild(tdAudit);

    // 5. Bar
    const tdBar = document.createElement('td');
    tdBar.className = 'ht-quality-cell-bar';
    const bar = pickBarIcon(tool);
    const barPill = document.createElement('span');
    barPill.className = 'ht-quality-status-pill';
    barPill.setAttribute('data-status', bar.status);
    barPill.textContent = bar.icon;
    barPill.setAttribute('aria-label', bar.label);
    barPill.title = bar.label;
    tdBar.appendChild(barPill);
    tr.appendChild(tdBar);

    // 6+. Criterion matrix (10 cells, one per criterion)
    const matrix = buildCriterionStatusMap(tool);
    for (let i = 0; i < criteria.length; i += 1) {
      const c = criteria[i];
      const entry = matrix.find(function (m) { return m.num === c.num; }) || { num: c.num, status: 'UNKNOWN' };
      const td = document.createElement('td');
      td.className = 'ht-quality-cell-criterion ht-quality-remediation-cell';
      td.setAttribute('data-criterion', String(c.num));
      td.setAttribute('data-status', entry.status);
      td.setAttribute('data-ht-tool', tool.slug);
      td.setAttribute('data-ht-action', 'expand-remediation');
      td.setAttribute('title', c.name);
      td.setAttribute('aria-label', c.name + ' — ' + entry.status);
      td.tabIndex = 0;
      td.textContent = entry.status === 'PASS' ? 'P' : entry.status === 'WARN' ? 'W' : entry.status === 'FAIL' ? 'F' : entry.status === 'MANUAL' ? 'M' : '?';
      // aria-describedby points at the rubric summary's criterion anchor so
      // screen readers surface the remediation copy when the cell is focused.
      td.setAttribute('aria-describedby', 'c' + c.num);
      tr.appendChild(td);
    }

    return tr;
  }

  // ---------- rubric summary ----------

  function renderRubricSummary(criteria) {
    const host = HT.qs('#' + RUBRIC_LIST_ID);
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    for (let i = 0; i < criteria.length; i += 1) {
      const c = criteria[i];
      const details = document.createElement('details');
      details.id = 'c' + c.num;
      details.className = 'ht-quality-rubric-item';
      const summary = document.createElement('summary');
      const numSpan = document.createElement('span');
      numSpan.className = 'ht-quality-num';
      numSpan.textContent = String(c.num) + '.';
      summary.appendChild(numSpan);
      summary.appendChild(document.createTextNode(' ' + c.name));
      details.appendChild(summary);
      const body = document.createElement('p');
      body.className = 'ht-quality-remediation';
      body.textContent = c.remediation || 'See docs/quality-rubric.md for the full criterion text.';
      details.appendChild(body);
      host.appendChild(details);
    }
    host.setAttribute('data-mounted', 'true');
  }

  // ---------- table render ----------

  function compareSlug(a, b) {
    const sa = (a && a.slug) || '';
    const sb = (b && b.slug) || '';
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  function renderTable(data, criteria) {
    const tbody = HT.qs('#' + TBODY_ID);
    if (!tbody) return;
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);

    const tools = Array.isArray(data && data.tools) ? data.tools.slice().sort(compareSlug) : [];
    for (let i = 0; i < tools.length; i += 1) {
      tbody.appendChild(buildRow(tools[i], criteria));
    }

    // Wire the remediation toggles AFTER rows are in the DOM.
    attachCellHandlers(tbody);
  }

  function findRowForCell(cell) {
    // Walk up to the closest <tr data-ht-tool="..."> ancestor.
    let node = cell.parentNode;
    while (node && node !== document) {
      if (node.nodeType === 1 && node.tagName === 'TR' && node.getAttribute('data-ht-tool')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function attachCellHandlers(tbody) {
    // Click or hover on a non-PASS cell → toggle a remediation row under
    // the row. Clicking a different criterion cell on the SAME row
    // replaces the existing detail row's content (not toggle) — toggling
    // would leave stale criterion-N content visible for criterion M.
    const cells = HT.qsa('.ht-quality-remediation-cell', tbody);
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const handler = function (event) {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        if (event.type === 'keydown') {
          event.preventDefault();
        }
        const row = findRowForCell(cell);
        if (!row) return;
        const next = row.nextElementSibling;
        if (next && next.classList && next.classList.contains('ht-quality-remediation-row')) {
          // Same criterion → toggle open/closed.
          if (next.getAttribute('data-criterion') === cell.getAttribute('data-criterion')) {
            next.classList.toggle('is-open');
            return;
          }
          // Different criterion → remove the stale detail row, then
          // fall through to insert a fresh one below.
          row.parentNode.removeChild(next);
        }
        const detailRow = document.createElement('tr');
        detailRow.className = 'ht-quality-remediation-row';
        detailRow.setAttribute('data-criterion', cell.getAttribute('data-criterion') || '');
        const detTd = document.createElement('td');
        detTd.colSpan = 15;
        const detDiv = document.createElement('div');
        detDiv.className = 'ht-quality-remediation-detail is-open';
        const critNum = parseInt(cell.getAttribute('data-criterion') || '0', 10);
        const detail = HT.qs('#c' + critNum);
        // Pull the remediation copy verbatim from the rubric summary.
        const remediation = detail ? HT.qs('.ht-quality-remediation', detail) : null;
        const text = remediation ? (remediation.textContent || '') : '';
        detDiv.textContent = text;
        detTd.appendChild(detDiv);
        detailRow.appendChild(detTd);
        row.parentNode.insertBefore(detailRow, row.nextSibling);
      };
      cell.addEventListener('click', handler);
      cell.addEventListener('keydown', handler);
      cell.addEventListener('mouseenter', handler);
    }
  }

  // ---------- meta + error UI ----------

  function renderMeta(data) {
    const meta = HT.qs('#' + META_ID);
    if (!meta) return;
    const generated = data && typeof data.generated === 'string' ? data.generated : '';
    const release = data && typeof data.releaseVersion === 'string' ? data.releaseVersion : '';
    const count = Array.isArray(data && data.tools) ? data.tools.length : 0;
    const parts = [];
    if (release) parts.push('Release ' + escapeHtml(release));
    if (generated) parts.push('Generated ' + escapeHtml(formatGenerated(generated)));
    parts.push(count + ' tool' + (count === 1 ? '' : 's'));
    meta.textContent = parts.join(' · ');
  }

  function renderError(message) {
    const host = HT.qs('#' + ERROR_ID);
    if (!host) return;
    host.removeAttribute('hidden');
    host.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'ht-quality-error';
    box.setAttribute('role', 'alert');
    const text = document.createElement('span');
    text.textContent = 'Failed to load scorecard: ' + message;
    box.appendChild(text);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Retry';
    btn.addEventListener('click', function () {
      host.setAttribute('hidden', '');
      host.innerHTML = '';
      render();
    });
    box.appendChild(btn);
    host.appendChild(box);
  }

  // ---------- public API ----------

  let liveData = null;
  let liveCriteria = null;

  function publishApi() {
    window.HT = window.HT || {};
    window.HT.quality = Object.freeze({
      render: render,
      data: liveData ? Object.freeze(liveData) : null,
      criteria: liveCriteria ? Object.freeze(liveCriteria) : null,
      ready: Boolean(liveData && liveCriteria),
      version: VERSION,
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    return Promise.all([fetchJson(TOOLS_JSON_URL), fetchText(RUBRIC_URL)])
      .then(function (results) {
        const data = results[0];
        const markdown = results[1];
        const criteria = parseRubric(markdown);
        if (criteria.length !== 10) {
          throw new Error('rubric yielded ' + criteria.length + ' criteria (expected 10)');
        }
        liveData = data;
        liveCriteria = criteria;
        renderMeta(data);
        appendCriterionColumns(criteria);
        renderRubricSummary(criteria);
        renderTable(data, criteria);
        publishApi();
        return { data: data, criteria: criteria };
      })
      .catch(function (err) {
        console.warn('quality: render failed', err);
        renderError(err && err.message ? err.message : String(err));
        publishApi();
        return null;
      });
  }

  function boot() {
    if (window.HT && window.HT.quality && window.HT.quality.version) {
      // Another boot already installed the API (HMR, duplicate include).
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
