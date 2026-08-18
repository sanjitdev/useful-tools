#!/usr/bin/env python3
"""Confirm every href/src in the 10 quiz index.html files is broken
or working — by resolving the relative path against the URL and
checking the server response."""
import urllib.request, re, posixpath, sys

SLUGS = ['spirit-animal', 'future-partner', 'what-would-you-do',
         'decision-style', 'friend-match', 'car-finder',
         'fortune-cookie', 'time-traveler-therapist', 'dream-job',
         'last-meal']

total_broken = 0
for slug in SLUGS:
    base = f'/tools/packs/discovery/{slug}/'
    try:
        r = urllib.request.urlopen('http://localhost:8765' + base)
        html = r.read().decode('utf-8')
    except Exception as e:
        print(f'  {slug}: page ERROR {e}')
        continue
    hrefs = re.findall(r'(?:href|src)="([^"]+)"', html)
    broken = []
    for href in hrefs:
        if href.startswith('data:') or href.startswith('http') or href.startswith('#'):
            continue
        if href.startswith('/'):
            url = 'http://localhost:8765' + href
        else:
            resolved = posixpath.normpath(posixpath.join(base, href))
            # add leading slash back
            if not resolved.startswith('/'): resolved = '/' + resolved
            url = 'http://localhost:8765' + resolved
        try:
            r2 = urllib.request.urlopen(url, timeout=3)
            status = r2.status
        except urllib.error.HTTPError as e:
            status = e.code
            broken.append((href, resolved, e.code))
        except Exception as e:
            status = 0
            broken.append((href, resolved, str(e)))
    if broken:
        total_broken += len(broken)
        print(f'\n{slug}: {len(broken)} broken')
        for h, r, s in broken[:6]:
            print(f'  {s}  {h}  ->  {r}')
print(f'\nTOTAL BROKEN: {total_broken}')
