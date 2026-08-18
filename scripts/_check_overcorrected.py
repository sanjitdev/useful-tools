#!/usr/bin/env python3
import urllib.request, posixpath
base = '/packs/disc.html'
hrefs = ['../../../assets/css/base.css', '../../../index.html', '../../tools/date-picker-lab/index.html']
for h in hrefs:
    r = posixpath.normpath(posixpath.join(base, h))
    if not r.startswith('/'): r = '/' + r
    print(f'{h}  ->  {r}')
    rr = urllib.request.urlopen('http://localhost:8765' + r)
    print(f'  status={rr.status}  bytes={len(rr.read())}')
