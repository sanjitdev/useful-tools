/* ============================================
   Handy Tools — citation-styles.js (Story 9.2)
   Pure-function citation formatters for APA 7,
   MLA 9, Chicago 17. Plus author parser + ISBN /
   DOI / URL validators. No DOM. Exposes
   `window.HT.citation` so `citation-formatter.js`
   (and the smoke harness) can reuse the same
   implementation. ES2018.
   ============================================ */

(function () {
  'use strict';

  // Node-side boot (smoke harness).
  const _hasWindow = typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined';
  if (!_hasWindow) {
    globalThis.window = { HT: {} };
  }
  const window = globalThis.window;
  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Regexes — concatenated at module load so the same set of
  // patterns is used by `validateIsbn`, `validateDoi`, and the
  // smoke harness.
  // -------------------------------------------------------------

  // ISBN-10 (with optional X check digit) or ISBN-13. Allows an
  // optional "ISBN:" / "ISBN-10:" / "ISBN-13:" prefix and any
  // punctuation (dashes / spaces) between digits. The user can
  // paste a raw 10/13 digit string or `ISBN: 0-306-40615-2`.
  // The first capture group is the prefix; the second is the
  // digit-only body (after `[\s-]` stripping). The ISBN-13
  // branch comes FIRST so a 13-digit input doesn't match the
  // 10-digit prefix branch.
  const ISBN_RE = /(?:ISBN[\s:-]?)?((?:\d[\s-]*){12}\d|(?:\d[\s-]*){9}[\dXx])/;

  // DOI — matches the CrossRef-recommended shape: 10.NNNN/...
  // The character class covers the most common URL-safe and
  // punctuation characters that appear in real DOIs.
  const DOI_RE = /^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i;

  // URL — http or https only.
  const URL_RE = /^https?:/;

  // -------------------------------------------------------------
  // Author parsing
  //
  // Three input shapes are accepted:
  //   (1) "Last, First Middle"      → full first name kept
  //   (2) "Last, F. M."             → initials; APA uses initials
  //                                    (single letter + period + space)
  //   (3) Single name "Plato"       → no comma, no first
  //
  // Returns { last, first, initials, isOrg }. `initials` is the
  // APA-style abbreviated form (e.g. "F. M."); `first` is the
  // full first name when present. If the author string matches
  // no comma, it is treated as either an organization or a
  // single-name individual (we default to individual).
  // -------------------------------------------------------------

  function parseAuthor(s) {
    if (typeof s !== 'string') return { last: '', first: '', initials: '', isOrg: false };
    const text = s.trim();
    if (!text) return { last: '', first: '', initials: '', isOrg: false };
    const comma = text.indexOf(',');
    if (comma < 0) {
      // Single name — could be an organization (no first-name/last
      // structure). We don't have a reliable way to detect orgs
      // without a dictionary, so we just return it as a single-name
      // author and let each style render it appropriately.
      return { last: text, first: '', initials: '', isOrg: false };
    }
    const last = text.slice(0, comma).trim();
    const rest = text.slice(comma + 1).trim();
    if (!rest) return { last, first: '', initials: '', isOrg: false };
    // APA initials: capitalize first letter of each whitespace-
    // separated token, append a period, and join with spaces.
    const tokens = rest.split(/\s+/).filter(Boolean);
    const initials = tokens.map(function (t) {
      const c = t.charAt(0).toUpperCase();
      return c + '.';
    }).join(' ');
    return { last, first: rest, initials, isOrg: false };
  }

  // -------------------------------------------------------------
  // Validators
  // -------------------------------------------------------------

  function validateIsbn(s) {
    if (typeof s !== 'string') return null;
    const m = ISBN_RE.exec(s.trim());
    if (!m) return null;
    // Strip whitespace and dashes to get the digit-only body.
    const body = m[1].replace(/[\s-]/g, '');
    // Check-digit rules differ for ISBN-10 vs ISBN-13. We just
    // accept the shape and return the normalized digits.
    if (body.length === 10) {
      // ISBN-10: 9 digits + digit|X
      if (!/^\d{9}[\dXx]$/.test(body)) return null;
    } else if (body.length === 13) {
      // ISBN-13: 13 digits.
      if (!/^\d{13}$/.test(body)) return null;
    } else {
      return null;
    }
    return body;
  }

  function validateDoi(s) {
    if (typeof s !== 'string') return false;
    return DOI_RE.test(s.trim());
  }

  function isUrl(s) {
    if (typeof s !== 'string') return false;
    return URL_RE.test(s.trim());
  }

  // -------------------------------------------------------------
  // Placeholder helpers
  // -------------------------------------------------------------

  function _yearOrPlaceholder(year) {
    if (typeof year !== 'string' || !year.trim()) return '(n.d.)';
    return year.trim();
  }

  function _publisherOrPlaceholder(publisher) {
    if (typeof publisher !== 'string' || !publisher.trim()) return '(n.p.)';
    return publisher.trim();
  }

  function _titleOrPlaceholder(title) {
    if (typeof title !== 'string' || !title.trim()) return '(untitled)';
    return title.trim();
  }

  function _authorOrPlaceholder(author) {
    if (typeof author !== 'string' || !author.trim()) return '(unknown author)';
    return author.trim();
  }

  // -------------------------------------------------------------
  // APA 7 — `Author, A. A. (Year). Title of work. Publisher.`
  // Format: Last name, comma, then initials with periods and
  // spaces for the first name. Single-name authors render as
  // just the name (no comma).
  // -------------------------------------------------------------

  function formatApa7(input) {
    const author = _authorOrPlaceholder(input && input.author);
    const yearRaw = input && input.year;
    const year = _yearOrPlaceholder(yearRaw);
    const title = _titleOrPlaceholder(input && input.title);
    const publisher = _publisherOrPlaceholder(input && input.publisher);
    const parsed = parseAuthor(author);
    let authorStr;
    if (parsed.first) {
      authorStr = parsed.last + ', ' + (parsed.initials || parsed.first);
    } else {
      authorStr = parsed.last;
    }
    // APA renders "(n.d.)" when year is missing — the placeholder
    // already includes parens and the closing period, so we skip
    // our wrapping parens. MLA/Chicago use bare "n.d." but APA
    // wraps it in parentheses.
    const yearRender = (!yearRaw || !String(yearRaw).trim()) ? year : '(' + year + ').';
    return authorStr + ' ' + yearRender + ' ' + title + '. ' + publisher + '.';
  }

  // -------------------------------------------------------------
  // MLA 9 — `Author. "Title of work." Publisher, Year.`
  // MLA uses the full first name (no initials). Title is quoted.
  // -------------------------------------------------------------

  function formatMla9(input) {
    const author = _authorOrPlaceholder(input && input.author);
    const year = _yearOrPlaceholder(input && input.year);
    const title = _titleOrPlaceholder(input && input.title);
    const publisher = _publisherOrPlaceholder(input && input.publisher);
    const parsed = parseAuthor(author);
    // MLA renders the author with a full first name. If the first
    // name already ends with a period (the user typed "F." instead
    // of "Frank"), we don't add a second period.
    let authorStr;
    if (parsed.first) {
      const first = parsed.first;
      authorStr = parsed.last + ', ' + (first.match(/\.$/) ? first.slice(0, -1) : first);
    } else {
      authorStr = parsed.last;
    }
    return authorStr + '. "' + title + '." ' + publisher + ', ' + year + '.';
  }

  // -------------------------------------------------------------
  // Chicago 17 — Author. Title of work. Publisher, Year.
  // Chicago A (notes-bibliography) author style: full first name
  // after the last name, comma-separated for the first author.
  // -------------------------------------------------------------

  function formatChicago17(input) {
    const author = _authorOrPlaceholder(input && input.author);
    const year = _yearOrPlaceholder(input && input.year);
    const title = _titleOrPlaceholder(input && input.title);
    const publisher = _publisherOrPlaceholder(input && input.publisher);
    const parsed = parseAuthor(author);
    let authorStr;
    if (parsed.first) {
      const first = parsed.first;
      authorStr = parsed.last + ', ' + (first.match(/\.$/) ? first.slice(0, -1) : first);
    } else {
      authorStr = parsed.last;
    }
    return authorStr + '. ' + title + '. ' + publisher + ', ' + year + '.';
  }

  // -------------------------------------------------------------
  // Dispatcher
  // -------------------------------------------------------------

  function formatCitation(style, input) {
    if (style === 'apa-7') return formatApa7(input);
    if (style === 'mla-9') return formatMla9(input);
    if (style === 'chicago-17') return formatChicago17(input);
    // Unknown style — throw so a typo (e.g. "APA-7" from a stale URL
    // hash, or an upstream schema enum drift) surfaces as a visible
    // status error instead of silently rendering APA. The tool's
    // getStyle() whitelist pre-filters the value, so this branch only
    // fires on a programming error. AC-1 specifies exactly three
    // style strings; anything else is a contract violation.
    throw new Error('HT.citation.formatCitation: unknown style "' + style + '" (expected apa-7 | mla-9 | chicago-17)');
  }

  // -------------------------------------------------------------
  // Self-test (CommonJS only — runs only in Node).
  // ============================================================ */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseAuthor: parseAuthor,
      validateIsbn: validateIsbn,
      validateDoi: validateDoi,
      isUrl: isUrl,
      formatApa7: formatApa7,
      formatMla9: formatMla9,
      formatChicago17: formatChicago17,
      formatCitation: formatCitation,
    };
  }

  // -------------------------------------------------------------
  // Browser export — exposed under `window.HT.citation`.
  // -------------------------------------------------------------

  Object.defineProperty(HT, 'citation', {
    value: Object.freeze({
      parseAuthor: parseAuthor,
      validateIsbn: validateIsbn,
      validateDoi: validateDoi,
      isUrl: isUrl,
      formatApa7: formatApa7,
      formatMla9: formatMla9,
      formatChicago17: formatChicago17,
      formatCitation: formatCitation,
    }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
