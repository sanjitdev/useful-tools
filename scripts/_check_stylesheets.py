#!/usr/bin/env python3
"""Compare stylesheets on a Discovery quiz page vs a regular tool page."""
import urllib.request
for path in ['/tools/packs/discovery/spirit-animal/',
             '/tools/packs/discovery/last-meal/',
             '/tools/packs/discovery/fortune-cookie/',
             '/tools/bmi-calculator/',
             '/tools/date-picker-lab/',
             '/packs/disc.html']:
    r = urllib.request.urlopen('http://localhost:8765' + path)
    html = r.read().decode('utf-8')
    print('===', path, '===')
    for line in html.splitlines():
        if 'stylesheet' in line:
            print(' ', line.strip())
    print()
