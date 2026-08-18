#!/usr/bin/env python3
import os, posixpath
base = '/tools/packs/discovery/spirit-animal/'
href = '../../assets/css/base.css'
resolved = posixpath.normpath(posixpath.join(base, href))
print('Resolved:', resolved)
local = 'C:/ZDrive Folders/Projects/useful-tools' + resolved
print('Local exists:', os.path.exists(local))
print('Base.css at repo root:', os.path.exists('C:/ZDrive Folders/Projects/useful-tools/assets/css/base.css'))
