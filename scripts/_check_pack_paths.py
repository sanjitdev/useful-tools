#!/usr/bin/env python3
import re
for f in ['packs/travel.html', 'packs/finance.html', 'packs/study.html',
          'packs/developer.html', 'packs/household.html', 'packs/fun.html',
          'packs/disc.html']:
    print('===', f, '===')
    src = open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?:href|src)="(\.\.[^"]*)"', src):
        print(' ', m.group(1))
