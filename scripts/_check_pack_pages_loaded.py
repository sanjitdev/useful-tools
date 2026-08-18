#!/usr/bin/env python3
"""Verify every pack + quiz page loads all relative-path assets."""
import urllib.request, re, posixpath, sys

PAGES = [
    '/packs/disc.html', '/packs/travel.html', '/packs/finance.html',
    '/packs/study.html', '/packs/developer.html', '/packs/household.html',
    '/packs/fun.html',
    '/tools/packs/discovery/spirit-animal/',
    '/tools/packs/discovery/last-meal/',
    '/tools/packs/discovery/fortune-cookie/',
    '/tools/bmi-calculator/',
    '/tools/date-picker-lab/',
]

all_bad = 0
for path in PAGES:
    try:
        r = urllib.request.urlopen('http://localhost:8765' + path)
    except Exception as e:
        print(f'PAGE ERROR {path}: {e}')
        continue
    html = r.read().decode('utf-8')
    bad = []
    for m in re.finditer(r'(?:href|src)="([^"]+)"', html):
        href = m.group(1)
        if href.startswith(('data:', 'http', '#')): continue
        if href.startswith('/'):
            if href.startswith(('/privacy', '/quality', '/view-source')):
                continue  # backend routes not served by http.server
            url = 'http://localhost:8765' + href
        else:
            r2 = posixpath.normpath(posixpath.join(path, href))
            if not r2.startswith('/'): r2 = '/' + r2
            url = 'http://localhost:8765' + r2
        try:
            urllib.request.urlopen(url, timeout=3)
        except urllib.error.HTTPError as e:
            bad.append((href, e.code, r2))
    if bad:
        all_bad += len(bad)
        print(f'\n{path}: {len(bad)} bad')
        for h, c, r in bad[:6]:
            print(f'  {c}  {h}  ->  {r}')
    else:
        print(f'OK    {path}')

print(f'\nTOTAL BAD: {all_bad}')
