#!/usr/bin/env python3
"""Trace all <link rel=stylesheet> hrefs, fetch each, report 4xx/5xx."""
import urllib.request, re, sys

PATHS = sys.argv[1:] or [
    '/tools/packs/discovery/spirit-animal/',
    '/tools/packs/discovery/last-meal/',
    '/tools/packs/discovery/fortune-cookie/',
    '/tools/bmi-calculator/',
    '/packs/disc.html',
]

for path in PATHS:
    print('===', path, '===')
    try:
        r = urllib.request.urlopen('http://localhost:8765' + path)
    except Exception as e:
        print('  PAGE ERROR:', e)
        continue
    html = r.read().decode('utf-8')
    # Extract link hrefs (could be stylesheet, script src, etc.)
    hrefs = re.findall(r'(?:href|src)="([^"]+)"', html)
    # Limit to absolute / relative within the same site
    for href in hrefs:
        if href.startswith('data:') or href.startswith('http') or not href:
            continue
        if href.startswith('/'):
            url = 'http://localhost:8765' + href
        else:
            # Resolve relative to the path's parent
            base = path.rsplit('/', 1)[0]
            url = 'http://localhost:8765' + base + '/' + href
        # Normalize .. and .
        import posixpath
        url_parts = list(filter(None, url.split('/')))
        scheme = url_parts[0]
        netloc = url_parts[1]
        path_parts = url_parts[2:]
        norm = []
        for p in path_parts:
            if p == '..':
                if norm: norm.pop()
            elif p == '.':
                pass
            else:
                norm.append(p)
        url = scheme + '//' + netloc + '/' + '/'.join(norm)

        try:
            r2 = urllib.request.urlopen(url, timeout=3)
            print(f'  {r2.status}  {url[len("http://localhost:8765"):]}')
        except urllib.error.HTTPError as e:
            print(f'  HTTP {e.code}  {url[len("http://localhost:8765"):]}')
        except Exception as e:
            print(f'  ERR    {url[len("http://localhost:8765"):]}  {e}')
