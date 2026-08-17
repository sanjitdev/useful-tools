#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-4-recommend.py — AC for DC-4 (HT.recommend + HT.catalog + data).

Verifies the recommendation module pair + assets/data/{catalog-profiles,cars,bikes}.json.
Target: 22 PASS after DC-4 lands.

Run: `make dc-4-recommend` or `python scripts/dc/dc-4-recommend.py`.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (
    check,
    exit_with_summary,
    file_exists,
    gzipped_size,
    read_text,
    repo_root,
    run_node,
)


def main():
    print("DC-4 — HT.recommend + HT.catalog + cars/bikes data (22 checks)")

    rec_path = "assets/js/recommend.js"
    cat_path = "assets/js/catalog.js"

    # 1, 2. Files exist
    check(file_exists(rec_path), f"{rec_path} exists on disk")
    check(file_exists(cat_path), f"{cat_path} exists on disk")

    rec_src = read_text(rec_path) or ""
    cat_src = read_text(cat_path) or ""

    # 3. api-contract defines both frozen (the freeze lives in the
    # module file, not in api-contract.js — same pattern as
    # scoring.js / results.js / challenge.js per the dc-1/2/3 gates).
    api = read_text("assets/js/api-contract.js") or ""
    has_freeze_rec = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]recommend[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        rec_src, re.DOTALL,
    ))
    has_freeze_cat = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]catalog[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        cat_src, re.DOTALL,
    ))
    has_doc_rec = bool(api) and "HT.recommend" in api
    has_doc_cat = bool(api) and "HT.catalog" in api
    check(
        has_freeze_rec and has_doc_rec,
        "assets/js/recommend.js freezes HT.recommend (writable:false, configurable:false) "
        "AND api-contract.js documents it",
    )
    check(
        has_freeze_cat and has_doc_cat,
        "assets/js/catalog.js freezes HT.catalog (writable:false, configurable:false) "
        "AND api-contract.js documents it",
    )

    # 4. shell-thin TIER2_URLS lists both
    shell = read_text("assets/js/shell-thin.js") or ""
    check(
        bool(shell) and "assets/js/recommend.js" in shell,
        "assets/js/shell-thin.js TIER2_URLS includes 'assets/js/recommend.js'",
    )
    check(
        bool(shell) and "assets/js/catalog.js" in shell,
        "assets/js/shell-thin.js TIER2_URLS includes 'assets/js/catalog.js'",
    )

    # 5. bundle-size-gate lists both
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check(
        bool(bsg) and '    "assets/js/recommend.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/recommend.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )
    check(
        bool(bsg) and '    "assets/js/catalog.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/catalog.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )

    # 6. assets/data/catalog-profiles.json declares car + bike domain weights
    profiles = None
    if file_exists("assets/data/catalog-profiles.json"):
        try:
            profiles = json.loads(
                (repo_root() / "assets/data/catalog-profiles.json").read_text(
                    encoding="utf-8"
                )
            )
        except Exception:
            profiles = None
    check(
        profiles is not None
        and isinstance(profiles.get("domains"), dict)
        and "car" in profiles["domains"]
        and "bike" in profiles["domains"],
        "assets/data/catalog-profiles.json declares car + bike domain weights",
    )

    # 7, 8. cars.json + bikes.json each have >= 10 entries
    cars = None
    bikes = None
    if file_exists("assets/data/cars.json"):
        try:
            cars = json.loads(
                (repo_root() / "assets/data/cars.json").read_text(encoding="utf-8")
            )
        except Exception:
            cars = None
    if file_exists("assets/data/bikes.json"):
        try:
            bikes = json.loads(
                (repo_root() / "assets/data/bikes.json").read_text(encoding="utf-8")
            )
        except Exception:
            bikes = None
    check(
        isinstance(cars, list) and len(cars) >= 10,
        f"assets/data/cars.json exists with >= 10 entries (got {len(cars) if isinstance(cars, list) else 'n/a'})",
    )
    check(
        isinstance(bikes, list) and len(bikes) >= 10,
        f"assets/data/bikes.json exists with >= 10 entries (got {len(bikes) if isinstance(bikes, list) else 'n/a'})",
    )

    # 9. every catalog item carries id, domain, attrs{}, why
    def _has_shape(item):
        return (
            isinstance(item, dict)
            and isinstance(item.get("id"), str)
            and item.get("domain") in ("car", "bike")
            and isinstance(item.get("attrs"), dict)
            and isinstance(item.get("why"), str)
        )

    if isinstance(cars, list):
        all_ok = all(_has_shape(c) for c in cars)
        check(all_ok, "Every cars[] entry carries id, domain, attrs{}, why")
    else:
        check(False, "Every cars[] entry carries id, domain, attrs{}, why [no data]")

    if isinstance(bikes, list):
        all_ok = all(_has_shape(b) for b in bikes)
        check(all_ok, "Every bikes[] entry carries id, domain, attrs{}, why")
    else:
        check(False, "Every bikes[] entry carries id, domain, attrs{}, why [no data]")

    # 10. catalog JS is local — no CDN fetch (string check)
    cat_src_combined = (cat_src + rec_src).lower()
    check(
        bool(cat_src) and "fetch(" not in cat_src
        and "http://" not in cat_src
        and "https://" not in cat_src,
        "catalog.js is local (no fetch/http URLs — only assets/data/)",
    )

    # 11..18. Runtime: load both modules in a vm sandbox and exercise list/lazyLoad/match
    # Path substitution (mirrors the dc-1 / dc-2 / dc-3 gate fixes) so
    # the file paths work under `node -` (stdin) where __dirname is undefined.
    fixture = (
        r"""
'use strict';
const fs = require('fs');
const vm = require('vm');

const CAT_PATH = __CATALOG_PATH__;
const REC_PATH = __RECOMMEND_PATH__;
const catSrc = fs.readFileSync(CAT_PATH, 'utf8');
const recSrc = fs.readFileSync(REC_PATH, 'utf8');

// Pre-load the data the catalog is expected to read from disk so
// the vm doesn't need a real fs module.
const cats = JSON.parse(fs.readFileSync(__CARS_PATH__, 'utf8'));
const bikes = JSON.parse(fs.readFileSync(__BIKES_PATH__, 'utf8'));
const profiles = JSON.parse(fs.readFileSync(__PROFILES_PATH__, 'utf8'));

// Minimal fetch shim — the catalog may use either fs or HT.net.get;
// we wire both paths so the runtime check passes regardless.
const ctx = {
  HT: {
    __data: { car: cats, bike: bikes },
    __profiles: profiles,
  },
  console,
};
// recommend.js + catalog.js are IIFEs that pick `window.HT` ||
// `self.HT` || {}. Without those aliases, writes go to a fresh
// local object — invisible to the caller. Mirror the shape used
// by scripts/_smoke_recommend.js: expose window + self + global
// aliases pointing at the shared HT so the IIFE's writes land.
ctx.window = ctx;
ctx.self = ctx;
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(catSrc, ctx);
vm.runInContext(recSrc, ctx);

const cat = ctx.HT.catalog;
const rec = ctx.HT.recommend;

const out = {};
try {
  out.hasList = typeof cat.list === 'function';
  out.hasLazy = typeof cat.lazyLoad === 'function';
  out.hasMatch = typeof rec.match === 'function';

  if (out.hasList) {
    const list = cat.list();
    out.listHasCar = list && (list.car || 0) >= 10;
    out.listHasBike = list && (list.bike || 0) >= 10;
  }

  if (out.hasMatch) {
    const profile = {
      traits: { efficiency: 0.7, comfort: 0.4, sportiness: 0.2 },
      weights: { price: 0.5, fuel: 0.3, space: 0.2 },
    };
    const r = rec.match(profile, 'car');
    out.matchShape = r && r.top && r.alternatives && r.explain;
    out.topNotNull = r && r.top !== null && typeof r.top === 'object';
    out.altsAtLeast1 = r && Array.isArray(r.alternatives) && r.alternatives.length >= 1;
    out.scoreInRange = r && r.top && typeof r.top.score === 'number'
      && r.top.score >= 0 && r.top.score <= 100;
    out.whyMatchIsStrs = r && Array.isArray(r.explain && r.explain.whyMatch)
      && r.explain.whyMatch.every((s) => typeof s === 'string');
    out.whyNotIsStrs = r && Array.isArray(r.explain && r.explain.whyNot)
      && r.explain.whyNot.every((s) => typeof s === 'string');

    // 16: deterministic
    const r2 = rec.match(profile, 'car');
    out.deterministic = r && r2 && r.top && r2.top && r.top.id === r2.top.id;
  }
} catch (e) { out.error = String(e && e.message || e); }

process.stdout.write('JSON:' + JSON.stringify(out));
"""
    ).replace(
        "__CATALOG_PATH__",
        json.dumps(str((repo_root() / "assets/js/catalog.js").resolve())),
    ).replace(
        "__RECOMMEND_PATH__",
        json.dumps(str((repo_root() / "assets/js/recommend.js").resolve())),
    ).replace(
        "__CARS_PATH__",
        json.dumps(str((repo_root() / "assets/data/cars.json").resolve())),
    ).replace(
        "__BIKES_PATH__",
        json.dumps(str((repo_root() / "assets/data/bikes.json").resolve())),
    ).replace(
        "__PROFILES_PATH__",
        json.dumps(str((repo_root() / "assets/data/catalog-profiles.json").resolve())),
    )
    if file_exists(cat_path) and file_exists(rec_path) and isinstance(cars, list) and isinstance(bikes, list):
        rc, stdout, stderr = run_node(fixture)
        runtime = {}
        for line in stdout.splitlines()[::-1]:
            if line.startswith("JSON:"):
                try:
                    runtime = json.loads(line[5:])
                except Exception:
                    runtime = {}
                break

        check(runtime.get("hasList"), "HT.catalog.list() is callable")
        check(runtime.get("hasLazy"), "HT.catalog.lazyLoad(domain) is callable")
        check(runtime.get("hasMatch"), "HT.recommend.match(profile, domain) is callable")
        check(runtime.get("listHasCar"), "HT.catalog.list() returns car count >= 10")
        check(runtime.get("listHasBike"), "HT.catalog.list() returns bike count >= 10")
        check(runtime.get("matchShape"), "HT.recommend.match returns {top, alternatives, explain}")
        check(runtime.get("topNotNull"), "top is an object (not null) when catalog is non-empty")
        check(runtime.get("altsAtLeast1"), "alternatives has >= 1 entry when catalog has >= 2 items")
        check(runtime.get("scoreInRange"), "match score is in [0, 100]")
        check(runtime.get("whyMatchIsStrs"), "explain.whyMatch is an array of strings")
        check(runtime.get("whyNotIsStrs"), "explain.whyNot is an array of strings")
        check(runtime.get("deterministic"), "match is deterministic (same profile -> same top.id)")
    else:
        for label in (
            "HT.catalog.list() is callable",
            "HT.catalog.lazyLoad(domain) is callable",
            "HT.recommend.match(profile, domain) is callable",
            "HT.catalog.list() returns car count >= 10",
            "HT.catalog.list() returns bike count >= 10",
            "HT.recommend.match returns {top, alternatives, explain}",
            "top is an object (not null) when catalog is non-empty",
            "alternatives has >= 1 entry when catalog has >= 2 items",
            "match score is in [0, 100]",
            "explain.whyMatch is an array of strings",
            "explain.whyNot is an array of strings",
            "match is deterministic (same profile -> same top.id)",
        ):
            check(False, label + " [catalog/recommend/data missing]")

    # 19. shell-bounds-check.py passes for both files
    r = subprocess.run(
        [sys.executable, str(repo_root() / "scripts" / "shell-bounds-check.py")],
        capture_output=True,
        text=True,
    )
    check(
        r.returncode == 0,
        "scripts/shell-bounds-check.py passes for recommend.js + catalog.js",
    )

    # 20, 21. gzipped sizes
    sz_rec = gzipped_size(rec_path) if file_exists(rec_path) else None
    check(
        sz_rec is not None and sz_rec <= 4000,
        f"gzipped size of recommend.js <= 4,000 bytes (got {sz_rec})",
    )
    sz_cat = gzipped_size(cat_path) if file_exists(cat_path) else None
    check(
        sz_cat is not None and sz_cat <= 4000,
        f"gzipped size of catalog.js <= 4,000 bytes (got {sz_cat})",
    )

    # 22. scripts/_smoke_recommend.js exists and exits 0
    smoke = "scripts/_smoke_recommend.js"
    if file_exists(smoke):
        # Run the smoke file directly as a script entry point — NOT via
        # stdin (`node -`), because the harness resolves asset paths
        # relative to __dirname, and a stdin pipe leaves __dirname as
        # the cwd (typically the repo root, not scripts/), causing the
        # readFileSync on assets/js/catalog.js to crash with ENOENT
        # before any assertions run (same fix as dc-1-scoring.py,
        # dc-2-results.py, dc-3-challenge.py).
        r = subprocess.run(
            ["node", str(repo_root() / smoke)],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        check(r.returncode == 0, f"{smoke} exists and exits 0 via node (rc={r.returncode})")
    else:
        check(False, f"{smoke} exists and exits 0 via node [missing]")

    exit_with_summary("DC-4")


if __name__ == "__main__":
    main()