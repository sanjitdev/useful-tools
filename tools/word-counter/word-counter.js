/* ============================================
   Word Counter
   Live counts of characters, words, sentences, paragraphs,
   reading time. Optional longest-word highlight.
   ============================================ */

(function () {
  'use strict';

  var ta = HT.$('#text');
  var highlightCb = HT.$('#highlight');
  var clearBtn = HT.$('#clear');
  var longestEl = HT.$('#longest');

  function update() {
    var text = ta.value;

    var chars = text.length;
    var charsNS = text.replace(/\s/g, '').length;

    var wordMatches = text.match(/\S+/g) || [];
    var words = wordMatches.length;

    // Sentences: count terminators (. ! ?) that end a non-space char
    var sentences = 0;
    var trimmed = text.trim();
    if (trimmed.length > 0) {
      var matches = trimmed.match(/[.!?]+(?=\s|$)/g);
      sentences = matches ? matches.length : 1;
    }

    // Paragraphs: count non-empty lines separated by blank lines
    var paragraphs = 0;
    if (trimmed.length > 0) {
      var blocks = trimmed.split(/\n\s*\n/);
      paragraphs = blocks.filter(function (b) { return b.trim().length > 0; }).length;
    }

    // Reading time at 200 wpm
    var minutes = words / 200;
    var readingStr;
    if (words === 0) readingStr = '0 sec';
    else if (minutes < 1) readingStr = Math.max(1, Math.round(words / 200 * 60)) + ' sec';
    else readingStr = (Math.round(minutes * 10) / 10) + ' min';

    HT.$('#c-chars').textContent = HT.formatNumber(chars);
    HT.$('#c-chars-ns').textContent = HT.formatNumber(charsNS);
    HT.$('#c-words').textContent = HT.formatNumber(words);
    HT.$('#c-sentences').textContent = HT.formatNumber(sentences);
    HT.$('#c-paragraphs').textContent = HT.formatNumber(paragraphs);
    HT.$('#c-reading').textContent = readingStr;

    // Longest word
    var longest = '';
    var longestLen = 0;
    for (var i = 0; i < wordMatches.length; i++) {
      var w = wordMatches[i];
      var clean = w.replace(/^[^\w]+|[^\w]+$/g, '');
      if (clean.length > longestLen) {
        longestLen = clean.length;
        longest = clean;
      }
    }

    if (highlightCb.checked && longest) {
      // Render text with longest word highlighted (only first occurrence)
      var escText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      var escapedLongest = longest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('\\b(' + escapedLongest + ')\\b');
      var replaced = escText.replace(re, '<mark class="longest">$1</mark>');
      longestEl.innerHTML = replaced;
      longestEl.classList.add('with-highlight');
    } else {
      longestEl.textContent = longest || '—';
      longestEl.classList.remove('with-highlight');
    }
  }

  // Seed with sample text so the page looks alive
  ta.value = 'The quick brown fox jumps over the lazy dog. ' +
    'Pack my box with five dozen liquor jugs. ' +
    'How vexingly quick daft zebras jump!\n\n' +
    'Try pasting a longer passage — counts update as you type.';

  var h = HT.debounce(update, 80);
  ta.addEventListener('input', h);
  highlightCb.addEventListener('change', update);
  clearBtn.addEventListener('click', function () {
    ta.value = '';
    update();
    ta.focus();
  });

  update();
})();