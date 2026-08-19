'use strict';
/* Quick smoke: serve index.html via local HTTP, then use puppeteer-core
   (if available) or jsdom to render and inspect the search DOM.

   Fallback: parse index.html with jsdom (vendored via npm). */
const fs = require('fs');
const path = require('path');
const http = require('http');

const REPO = path.resolve(__dirname, '..');
const PORT = 8765;

// Tiny static server.
const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(REPO, url);
  if (!filePath.startsWith(REPO)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, async () => {
  console.log('Serving on http://localhost:' + PORT);
  try {
    const resp = await fetch('http://localhost:' + PORT + '/index.html');
    const html = await resp.text();

    // Extract the rendered header section.
    const m = html.match(/<header class="site-header"[\s\S]*?<\/header>/);
    if (!m) { console.error('No header found'); server.close(); return; }
    const headerHtml = m[0];

    // Print first 600 chars.
    console.log('--- rendered header (first 800 chars) ---');
    console.log(headerHtml.slice(0, 800));
    console.log('---');

    // Sanity: count expected elements.
    const checks = [
      ['#header-search wrapper', /id="header-search"/],
      ['#header-search-icon button', /id="header-search-icon"/],
      ['#header-search-input input', /id="header-search-input"/],
      ['#header-search-panel container', /id="header-search-panel"/],
      ['#header-search-listbox ul', /id="header-search-listbox"/],
      ['#header-search-live region', /id="header-search-live"/],
      // Story 10.20 followup: the "Show all actions" CTA was removed
      // from the inline search footer, so the regex expects its
      // absence (regression guard).
      ['no #header-search-show-all CTA (regression guard)',
       (html) => !/id="header-search-show-all"/.test(html)],
    ];
    for (const [name, check] of checks) {
      const ok = (check instanceof RegExp) ? check.test(headerHtml) : check(headerHtml);
      console.log('  ' + (ok ? 'OK ' : 'NO ') + name);
    }
  } catch (err) {
    console.error('fetch err: ' + err.message);
  }
  server.close();
});