/* ============================================
   Markdown Previewer
   A small-from-scratch Markdown parser supporting common syntax.
   ============================================ */

(function () {
  'use strict';

  var DEFAULT_INPUT =
    '# Heading 1\n\n' +
    '## Heading 2\n\n' +
    'Some **bold** text and *italic* and `inline code`.\n\n' +
    '- Unordered item\n- Another item\n  - Nested item\n\n' +
    '1. Ordered item\n2. Another item\n\n' +
    '> A blockquote that goes on\n> for multiple lines.\n\n' +
    '---\n\n' +
    '```\ncode block\nwith multiple lines\n```\n\n' +
    'A [link](https://example.com) to the example site.';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Inline transforms (on escaped HTML) — order matters: code first.
  function inline(s) {
    // Inline code
    s = s.replace(/`([^`\n]+)`/g, function (_, c) {
      return '<code>' + c + '</code>';
    });
    // Escape has already happened before inline(); but the inline rules add back HTML, so
    // we re-run escape on the inserted contents where needed.
    // Bold then italic
    s = s.replace(/\*\*([^*\n]+)\*\*/g, function (_, c) { return '<strong>' + c + '</strong>'; });
    s = s.replace(/__([^_\n]+)__/g, function (_, c) { return '<strong>' + c + '</strong>'; });
    s = s.replace(/\*([^*\n]+)\*/g, function (_, c) { return '<em>' + c + '</em>'; });
    s = s.replace(/_([^_\n]+)_/g, function (_, c) { return '<em>' + c + '</em>'; });
    // Links [text](url) — only http(s)/relative; reject javascript:
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, url) {
      if (!/^(https?:\/\/|mailto:|\/|#|\.\.?\/)/i.test(url)) return text;
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + text + '</a>';
    });
    return s;
  }

  function parse(md) {
    var lines = md.replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var i = 0;

    function isBlank(s) { return !s || !s.trim(); }

    function flushList(tag) {
      // Collect list buffer from out until we hit a non-list-line
      var html = '';
      var stack = [{ tag: tag, items: [] }];
      while (i < lines.length) {
        var line = lines[i];
        var m;
        if (tag === 'ul' && (m = line.match(/^(\s*)([-*])\s+(.*)$/))) {
          var indent = Math.floor(m[1].length / 2);
          var text = m[3];
          while (indent >= stack.length) stack.push({ tag: tag, items: [] });
          var cur = stack[indent];
          // Different marker -> close current level
          if (cur.tag !== tag) { stack[indent] = { tag: tag, items: [] }; cur = stack[indent]; }
          // (Markdown allows same level / different marker here; we accept any.)
          // Add to current level
          cur.items.push(text);
          i++;
        } else if (tag === 'ol' && (m = line.match(/^(\s*)(\d+)\.\s+(.*)$/))) {
          var indent2 = Math.floor(m[1].length / 2);
          var text2 = m[3];
          while (indent2 >= stack.length) stack.push({ tag: tag, items: [] });
          var cur2 = stack[indent2];
          if (cur2.tag !== tag) { stack[indent2] = { tag: tag, items: [] }; cur2 = stack[indent2]; }
          cur2.items.push(text2);
          i++;
        } else if (isBlank(line) && i + 1 < lines.length) {
          // peek: if next line still looks like a list at any level
          var peek = lines[i + 1];
          if (/^\s*([-*]|\d+\.)\s+/.test(peek)) { i++; continue; }
          break;
        } else {
          break;
        }
      }
      // Render stack: each level is a list containing raw markdown items; render items inline now.
      function renderLevel(level) {
        var tagName = level.tag;
        var inner = level.items.map(function (raw) {
          // Render inline markdown on raw text
          var escaped = escapeHtml(raw);
          return '<li>' + inline(escaped) + '</li>';
        }).join('');
        return '<' + tagName + '>' + inner + '</' + tagName + '>';
      }
      // Render from outermost in: indent 0 always rendered, deeper only if non-empty
      var rendered = renderLevel(stack[0]);
      for (var k = 1; k < stack.length; k++) {
        if (stack[k].items.length) {
          // Wrap previous content of innermost <li>? Skip: we keep simple single-level.
        }
      }
      out.push(rendered);
    }

    while (i < lines.length) {
      var line = lines[i];

      if (isBlank(line)) { i++; continue; }

      // Heading
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var level = h[1].length;
        out.push('<h' + level + '>' + inline(escapeHtml(h[2].trim())) + '</h' + level + '>');
        i++;
        continue;
      }

      // Horizontal rule
      if (/^(\s*[-*_])\s*\1\s*\1[\s\1]*$/.test(line) || /^---+\s*$/.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // Code block
      if (/^```/.test(line)) {
        var lang = line.replace(/^```/, '').trim();
        i++;
        var codeLines = [];
        while (i < lines.length && !/^```/.test(lines[i])) {
          codeLines.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++; // skip closing fence
        var codeText = codeLines.join('\n');
        out.push('<pre><code' + (lang ? ' class="lang-' + escapeHtml(lang) + '"' : '') + '>' + escapeHtml(codeText) + '</code></pre>');
        continue;
      }

      // Blockquote (consecutive > lines)
      if (/^>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + inline(escapeHtml(quoteLines.join('\n'))) + '</blockquote>');
        continue;
      }

      // Unordered list
      if (/^(\s*)([-*])\s+/.test(line)) {
        flushList('ul');
        continue;
      }
      // Ordered list
      if (/^(\s*)\d+\.\s+/.test(line)) {
        flushList('ol');
        continue;
      }

      // Paragraph (consume until blank line)
      var paraLines = [line];
      i++;
      while (i < lines.length && !isBlank(lines[i]) &&
             !/^#{1,6}\s+/.test(lines[i]) &&
             !/^```/.test(lines[i]) &&
             !/^>\s?/.test(lines[i]) &&
             !/^---+\s*$/.test(lines[i]) &&
             !/^(\s*)([-*])\s+/.test(lines[i]) &&
             !/^(\s*)\d+\.\s+/.test(lines[i])) {
        paraLines.push(lines[i]);
        i++;
      }
      out.push('<p>' + inline(escapeHtml(paraLines.join('\n'))) + '</p>');
    }

    return out.join('\n');
  }

  var ta = HT.$('#md-input');
  var out = HT.$('#md-preview');

  if (!ta.value.trim()) ta.value = DEFAULT_INPUT;

  function update() {
    out.innerHTML = parse(ta.value);
  }

  ta.addEventListener('input', HT.debounce(update, 30));
  update();
})();