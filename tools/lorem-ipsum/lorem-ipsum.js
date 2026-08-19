/* ============================================
   Lorem Ipsum
   Generates placeholder text in paragraphs, sentences, or words.
   ============================================ */

(function () {
  'use strict';

  var CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' +
                'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ' +
                'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris ' +
                'nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in ' +
                'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla ' +
                'pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa ' +
                'qui officia deserunt mollit anim id est laborum.';

  var WORDS = ('a ac ad amet ante arcu at augue bibendum blandit commodo condimentum ' +
    'congue consectetur consequat convallis cubilia curabitur curae dapibus diam ' +
    'dictum dignissim dis dolor donec duis egestas eget eleifend elit enim erat eros ' +
    'et euismod ex facilisis faucibus felis fermentum feugiat fringilla fusce gravida ' +
    'habitasse hac hendrerit himenaeos habitant iaculis ipsum integer interdum justo ' +
    'lacinia lacus laoreet lectus leo libero ligula litora lobortis lorem luctus ' +
    'maecenas magna malesuada massa mattis mauris metus mi mollis morbi mus nam ' +
    'nascetur natoque nec neque netus nibh nisl nulla nullam nunc odio orci ornare ' +
    'pharetra placerat platea porta posuere potenti praesent pretium proin purus ' +
    'quam quisque rhoncus ridiculus risus rutrum sagittis sapien scelerisque sem ' +
    'semper senectus sit sociosqu sodales sollicitudin suscipit suspendisse tellus ' +
    'tempor tempus tincidunt torquent tortor tristique turpis ullamcorper ultrices ' +
    'ultricies urna ut varius vehicula vel velit venenatis vestibulum vitae vivamus ' +
    'viverra volutpat vulputate').split(/\s+/);

  var wordCount = WORDS.length;

  function randWord(i) {
    return WORDS[Math.floor(Math.abs(Math.sin(i + 1) * 9999) * 1000) % wordCount];
  }
  function randInt(max) {
    return 1 + Math.floor(Math.random() * max);
  }

  function sentence() {
    var len = randInt(14);
    var parts = [];
    for (var i = 0; i < len; i++) {
      var w = randWord(i + Date.now() + Math.floor(Math.random() * 99999));
      if (i === 0) w = w.charAt(0).toUpperCase() + w.slice(1);
      parts.push(w);
    }
    var s = parts.join(' ');
    // Add commas occasionally
    s = s.replace(/ ([a-z]{4,}) /g, function (m, w, idx, str) {
      // simple jitter
      return Math.random() < 0.1 ? ', ' + w + ' ' : m;
    });
    // Comma cleanup -> collapse double commas / spaces
    s = s.replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
    return s + '.';
  }

  function paragraph(opts) {
    opts = opts || {};
    var sentences = [];
    var n = opts.firstClassic ? 1 : 0;
    var count = randInt(5) + 3; // 3-7 extra sentences
    if (opts.firstClassic) sentences.push(CLASSIC);
    for (var i = 0; i < count; i++) sentences.push(sentence());
    return sentences.join(' ');
  }

  function wordList(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(randWord(i + Date.now() + Math.floor(Math.random() * 99999)));
    return out.join(' ');
  }

  function generate(count, unit, classic, asHtml) {
    count = Math.max(1, count | 0);
    if (unit === 'words') {
      var w = wordList(count);
      return asHtml ? '<p>' + w + '</p>' : w;
    }
    if (unit === 'sentences') {
      var arr = [];
      for (var i = 0; i < count; i++) {
        if (classic && i === 0) arr.push(CLASSIC);
        else arr.push(sentence());
      }
      return asHtml ? arr.map(function (s) { return '<p>' + s + '</p>'; }).join('\n') : arr.join(' ');
    }
    // paragraphs
    var paras = [];
    for (var j = 0; j < count; j++) {
      paras.push(paragraph({ firstClassic: classic && j === 0 }));
    }
    if (asHtml) return paras.map(function (p) { return '<p>' + p + '</p>'; }).join('\n');
    return paras.join('\n\n');
  }

  function countWords(s) { return s.trim().split(/\s+/).filter(Boolean).length; }
  function countSentences(s) { return (s.match(/[.!?]+/g) || []).length; }
  function countParagraphs(s) { return s.split(/\n\n+/).filter(function (p) { return p.trim(); }).length; }

  var outEl = HT.$('#output');
  var outTitle = HT.$('#output-title');
  var outSub = HT.$('#output-sub');

  function showResult(text) {
    var sub = HT.formatNumber(countWords(text)) + ' words · ' +
              HT.formatNumber(countSentences(text)) + ' sentences · ' +
              HT.formatNumber(countParagraphs(text)) + ' paragraph' + (countParagraphs(text) === 1 ? '' : 's');
    outTitle.textContent = 'Your text';
    outSub.textContent = sub;
    if (HT.$('#html').checked) {
      // Render as HTML for visualization; the "copy" button still copies the raw HTML source.
      var preview = document.createElement('div');
      preview.innerHTML = text;
      outEl.innerHTML = '';
      outEl.appendChild(preview);
    } else {
      outEl.textContent = text;
    }
  }

  function generateAndShow() {
    var count = parseInt(HT.$('#count').value, 10);
    var unit = HT.$('#unit').value;
    var classic = HT.$('#classic').checked;
    var asHtml = HT.$('#html').checked;
    var text = generate(count, unit, classic, asHtml);
    showResult(text);
  }

  HT.$('#generate').addEventListener('click', generateAndShow);
  HT.$('#copy').addEventListener('click', function () {
    var html = HT.$('#html').checked;
    var text = outEl.textContent;
    // For HTML mode, copy the actual HTML (re-serialize preview)
    if (html) {
      var preview = outEl.firstChild;
      text = preview ? preview.innerHTML : outEl.textContent;
    }
    HT.copyToClipboard(text);
  });

  generateAndShow();
})();