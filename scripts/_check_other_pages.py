#!/usr/bin/env python3
import urllib.request, re, posixpath
for path in ['/tools/bmi-calculator/', '/tools/date-picker-lab/', '/packs/disc.html']:
    r = urllib.request.urlopen('http://localhost:8765' + path)
    html = r.read().decode('utf-8')
    bad = []
    for m in re.finditer(r'(?:href|src)="([^"]+)"', html):
        href = m.group(1)
        if href.startswith(('data:', 'http', '#')): continue
        if href.startswith('/'):
            url = 'http://localhost:8765' + href
        else:
            r2 = posixpath.normpath(posixpath.join(path, href))
            if not r2.startswith('/'): r2 = '/' + r2
            url = 'http://localhost:8765' + r2
        try:
            urllib.request.urlopen(url, timeout=3)
        except urllib.error.HTTPError as e:
            bad.append((href, e.code, r2))
    print(path, '— bad:', bad if bad else 'all 200')
