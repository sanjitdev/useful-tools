/* ============================================
   Citation Formatter — Story 9.2
   Format citations in APA 7, MLA 9, or
   Chicago 17. Manual fields + ISBN lookup via
   Open Library (user-initiated). DOI regex
   validation. URL regex detection. All
   network requests go through HT.net.json.
   ============================================ */

(function () {
  'use strict';

  // Defensive guard: assets/js/citation-styles.js must be loaded BEFORE
  // this script. The smoke harness and the regression sweep both wire
  // the citation library onto HT.citation before running this IIFE.
  // If the library surface is missing (the script was loaded out of
  // order or skipped), bail out with a console warning — no DOM
  // mutation happens and the page stays in the empty initial state.
  if (!HT.citation || typeof HT.citation.formatCitation !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('citation-formatter: HT.citation is unavailable; ' +
        'assets/js/citation-styles.js must load before citation-formatter.js.');
    }
    return;
  }

  var styleSel = HT.$('#cite-style');
  var authorIn = HT.$('#cite-author');
  var titleIn = HT.$('#cite-title');
  var yearIn = HT.$('#cite-year');
  var publisherIn = HT.$('#cite-publisher');
  var isbnIn = HT.$('#cite-isbn');
  var lookupBtn = HT.$('#cite-lookup-isbn');
  var lookupError = HT.$('#cite-lookup-error');
  var doiIn = HT.$('#cite-doi');
  var doiValid = HT.$('#cite-doi-valid');
  var sourceIn = HT.$('#cite-source');
  var outEl = HT.$('#cite-output');
  var doiLinkWrap = HT.$('#cite-doi-link-wrap');
  var doiLink = HT.$('#cite-doi-link');
  var sourceLinkWrap = HT.$('#cite-source-link-wrap');
  var sourceLink = HT.$('#cite-source-link');
  var copyBtn = HT.$('#cite-copy');
  var genBtn = HT.$('#cite-generate');
  var status = HT.$('#cite-status');

  var OPEN_LIBRARY_URL = 'https://openlibrary.org/api/books?bibkeys=ISBN:';
  var STATUS_CLS = { success: 'success', error: 'error', idle: '' };

  function setStatus(text, cls) {
    if (!status) return;
    status.className = cls || '';
    status.textContent = text || '';
  }

  function setLookupError(msg) {
    if (!lookupError) return;
    if (msg) {
      lookupError.textContent = msg;
      lookupError.hidden = false;
    } else {
      lookupError.textContent = '';
      lookupError.hidden = true;
    }
  }

  // ------ Build citation from current field values ------
  function currentInput() {
    return {
      author: authorIn ? authorIn.value : '',
      title: titleIn ? titleIn.value : '',
      year: yearIn ? yearIn.value : '',
      publisher: publisherIn ? publisherIn.value : '',
    };
  }

  function getStyle() {
    if (!styleSel) return 'apa-7';
    var v = styleSel.value || 'apa-7';
    if (v !== 'apa-7' && v !== 'mla-9' && v !== 'chicago-17') return 'apa-7';
    return v;
  }

  function render() {
    if (!outEl) return;
    var style = getStyle();
    var text;
    try {
      text = HT.citation.formatCitation(style, currentInput());
    } catch (err) {
      // formatCitation throws on unknown style. getStyle() whitelists
      // and falls back to 'apa-7', so this branch is defensive only —
      // if it fires, surface a status error instead of leaving the
      // previous rendered output in place.
      setStatus('Render failed: ' + (err.message || err), 'error');
      return;
    }
    // Wrap missing-field placeholders in <span class="citation-missing">
    // for visual highlight. Only the open paren (n.d.) / (n.p.) /
    // (untitled) / (unknown author) markers get wrapped.
    var html = text
      .replace(/\(n\.d\.\)/g, '<span class="citation-missing" data-field="year">(n.d.)</span>')
      .replace(/\(n\.p\.\)/g, '<span class="citation-missing" data-field="publisher">(n.p.)</span>')
      .replace(/\(untitled\)/g, '<span class="citation-missing" data-field="title">(untitled)</span>')
      .replace(/\(unknown author\)/g, '<span class="citation-missing" data-field="author">(unknown author)</span>');
    outEl.innerHTML = html;

    // Update DOI link
    if (doiLinkWrap && doiLink) {
      var doi = doiIn ? (doiIn.value || '').trim() : '';
      if (doi && HT.citation.validateDoi(doi)) {
        doiLink.textContent = doi;
        doiLink.href = 'https://doi.org/' + doi;
        doiLinkWrap.hidden = false;
      } else {
        doiLinkWrap.hidden = true;
      }
    }

    // Update source URL link
    if (sourceLinkWrap && sourceLink) {
      var src = sourceIn ? (sourceIn.value || '').trim() : '';
      if (src && HT.citation.isUrl(src)) {
        sourceLink.textContent = src;
        sourceLink.href = src;
        sourceLinkWrap.hidden = false;
      } else {
        sourceLinkWrap.hidden = true;
      }
    }

    setStatus('Formatted as ' + style + '.', 'success');
  }

  // ------ DOI live validation ------
  function validateDoiLive() {
    if (!doiIn || !doiValid) return;
    var v = doiIn.value || '';
    if (v && HT.citation.validateDoi(v)) {
      doiValid.hidden = false;
    } else {
      doiValid.hidden = true;
    }
  }

  // ------ ISBN Lookup (user-initiated) ------
  function urlBuilder(isbn) {
    return OPEN_LIBRARY_URL + encodeURIComponent(isbn) + '&format=json&jscmd=data';
  }

  function doLookup() {
    if (!isbnIn) return;
    var raw = (isbnIn.value || '').trim();
    var isbn = HT.citation.validateIsbn(raw);
    if (!isbn) {
      setLookupError('Please enter a valid ISBN-10 or ISBN-13.');
      return;
    }
    setLookupError('');
    setStatus('Looking up ISBN ' + isbn + ' on Open Library…', 'idle');
    if (lookupBtn) lookupBtn.disabled = true;
    HT.net.json(urlBuilder(isbn))
      .then(function (data) {
        if (lookupBtn) lookupBtn.disabled = false;
        var key = 'ISBN:' + isbn;
        var entry = data && data[key];
        if (!entry) {
          setLookupError('No metadata found for ISBN ' + isbn + ' on Open Library. Please fill in fields manually.');
          setStatus('Lookup returned no data.', 'error');
          return;
        }
        // Open Library `data` field: { authors: [...], title, publishers: [...], publish_date }
        if (entry.authors && entry.authors.length && authorIn) {
          var first = entry.authors[0];
          var name = first.name || '';
          // If the name is "Last, First" keep as-is; Open Library usually
          // returns "First Last" — convert to "Last, First" for our parser.
          if (name && name.indexOf(',') < 0) {
            var parts = name.split(' ').filter(Boolean);
            if (parts.length >= 2) {
              var last = parts[parts.length - 1];
              var firstName = parts.slice(0, -1).join(' ');
              name = last + ', ' + firstName;
            }
          }
          authorIn.value = name;
        }
        if (entry.title && titleIn) titleIn.value = entry.title;
        if (entry.publish_date && yearIn) {
          // publish_date is often "January 1, 2020" — take the year.
          var match = /\b(19|20)\d{2}\b/.exec(entry.publish_date);
          if (match) yearIn.value = match[0];
        }
        if (entry.publishers && entry.publishers.length && publisherIn) {
          publisherIn.value = entry.publishers[0].name || '';
        }
        setStatus('Imported metadata for ISBN ' + isbn + '.', 'success');
        render();
      })
      .catch(function (err) {
        if (lookupBtn) lookupBtn.disabled = false;
        setLookupError('Metadata lookup failed — please fill in fields manually. (' + (err.message || err) + ')');
        setStatus('Lookup failed.', 'error');
      });
  }

  // ------ URL state ------
  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      return {
        style: params.get('style'),
        author: params.get('author'),
        title: params.get('title'),
        year: params.get('year'),
        publisher: params.get('publisher'),
      };
    } catch (_) {
      return { style: null, author: null, title: null, year: null, publisher: null };
    }
  }

  function writeUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      params.set('style', getStyle());
      if (authorIn) params.set('author', authorIn.value || '');
      if (titleIn) params.set('title', titleIn.value || '');
      if (yearIn) params.set('year', yearIn.value || '');
      if (publisherIn) params.set('publisher', publisherIn.value || '');
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }

  function applyUrlState() {
    var s = readUrlState();
    if (s.style && (s.style === 'apa-7' || s.style === 'mla-9' || s.style === 'chicago-17')) {
      if (styleSel) styleSel.value = s.style;
    }
    if (s.author && authorIn) authorIn.value = s.author;
    if (s.title && titleIn) titleIn.value = s.title;
    if (s.year && yearIn) yearIn.value = s.year;
    if (s.publisher && publisherIn) publisherIn.value = s.publisher;
  }

  // ------ Wire events ------
  function wire() {
    if (styleSel) styleSel.addEventListener('change', function () { render(); writeUrlState(); });
    var manualChange = HT.debounce(function () { render(); writeUrlState(); }, 200);
    if (authorIn) authorIn.addEventListener('input', manualChange);
    if (titleIn) titleIn.addEventListener('input', manualChange);
    if (yearIn) yearIn.addEventListener('input', manualChange);
    if (publisherIn) publisherIn.addEventListener('input', manualChange);
    if (doiIn) doiIn.addEventListener('input', function () { validateDoiLive(); render(); });
    if (sourceIn) sourceIn.addEventListener('input', render);

    if (lookupBtn) lookupBtn.addEventListener('click', doLookup);
    if (genBtn) genBtn.addEventListener('click', render);

    if (copyBtn) copyBtn.addEventListener('click', function () {
      // Copy the visible text (not the HTML)
      var text = outEl ? outEl.textContent : '';
      HT.copyToClipboard(text);
      setStatus('Citation copied.', 'success');
    });

    // Keyboard shortcuts: g = generate, c = copy
    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (ev.key === 'g' || ev.key === 'G') {
        ev.preventDefault();
        render();
      } else if (ev.key === 'c' || ev.key === 'C') {
        ev.preventDefault();
        if (outEl) HT.copyToClipboard(outEl.textContent || '');
      }
    });
  }

  // ------ Boot ------
  applyUrlState();
  validateDoiLive();
  wire();
  render();
})();
