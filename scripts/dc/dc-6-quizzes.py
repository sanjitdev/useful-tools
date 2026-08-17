#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-6-quizzes.py — AC for DC-6 (10 per-quiz routes).

For each of 10 quiz slugs, runs an 8-check bundle. Total ~80 PASS.
Slugs are read from tools.json so DC-7 doesn't have to land first —
if DC-7 hasn't landed, the script reports no quizzes found and exits
non-zero (DC-6 depends on DC-7 for the slug list).

Per quiz, checks:
  1. tools/packs/discovery/<slug>/index.html exists
  2. tools/packs/discovery/<slug>/<slug>-core.js exists
  3. tools/packs/discovery/<slug>/data.json exists and parses as JSON
  4. <slug>-core.js is the LAST classic <script> in index.html (rubric order)
  5. index.html includes the FOUC IIFE inline at the top (AD-15)
  6. data.json declares a `questions` array of length 3..30
  7. data.json declares a `scoring-spec` object with traits[], weights{}, archetypes[]
  8. <slug>-core.js calls HT.quiz.open({questions: ...}) — string check

Run: `make dc-6-quizzes` or `python scripts/dc/dc-6-quizzes.py`.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, read_text, repo_root


PACK_ROOT = "tools/packs/discovery"


def find_quiz_slugs():
    """Read tools.json — return the 10 Discovery entry slugs.

    Returns an empty list if DC-7 hasn't shipped yet. Caller decides
    whether to fail the gate.
    """
    tj = repo_root() / "tools.json"
    if not tj.is_file():
        return []
    try:
        tj_data = json.loads(tj.read_text(encoding="utf-8"))
    except Exception:
        return []
    pack = ((tj_data.get("packs") or {}).get("discovery") or {})
    entries = pack.get("entries") or []
    slugs = [e.get("slug") for e in entries if isinstance(e, dict) and e.get("slug")]
    return slugs


def script_tags_in_order(html):
    """Return [(attrs_dict, src_or_None), ...] for every <script> tag
    in document order, including inline ones. Used by check #4 to
    confirm `<slug>-core.js` is the LAST classic <script>.
    """
    pattern = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.DOTALL | re.IGNORECASE)
    out = []
    for m in pattern.finditer(html):
        attrs = m.group(1)
        body = m.group(2)
        # extract src
        src_m = re.search(r'src=["\']([^"\']+)["\']', attrs)
        src = src_m.group(1) if src_m else None
        # extract type
        type_m = re.search(r'type=["\']([^"\']+)["\']', attrs)
        stype = type_m.group(1).lower() if type_m else None
        # module scripts are excluded from "classic" check
        out.append({"src": src, "type": stype, "inline": src is None})
    return out


def check_one_quiz(slug):
    """Run the 8-check bundle for a single quiz slug."""
    slug_dir = f"{PACK_ROOT}/{slug}"
    index_html = f"{slug_dir}/index.html"
    core_js = f"{slug_dir}/{slug}-core.js"
    data_json = f"{slug_dir}/data.json"

    # 1. index.html exists
    check(file_exists(index_html), f"{index_html} exists")

    # 2. <slug>-core.js exists
    check(file_exists(core_js), f"{core_js} exists")

    # 3. data.json exists and parses as JSON
    data = None
    data_raw = read_text(data_json)
    if data_raw is None:
        check(False, f"{data_json} exists and parses as JSON")
    else:
        try:
            data = json.loads(data_raw)
            check(True, f"{data_json} exists and parses as JSON")
        except Exception as e:
            check(False, f"{data_json} exists and parses as JSON ({e})")

    # 4. <slug>-core.js is the LAST classic <script> in index.html
    html = read_text(index_html) or ""
    if html:
        scripts = script_tags_in_order(html)
        # Classic = has src and type is None or text/javascript or empty body module
        classics = [s for s in scripts if s["src"] and s["type"] != "module"]
        if classics:
            last = classics[-1]
            ends_with = last["src"] and last["src"].endswith(f"{slug}-core.js")
            check(
                ends_with,
                f"{index_html}: last classic <script src> is {slug}-core.js (got {last['src']!r})",
            )
        else:
            check(False, f"{index_html}: at least one classic <script src> tag present")
    else:
        check(False, f"{index_html}: contains classic <script> tags [file missing]")

    # 5. FOUC IIFE inline at the top (AD-15)
    # Pattern: looks for a top-of-body script that touches localStorage('ht.theme').
    # We accept any of the canonical patterns the existing tool pages use.
    if html:
        # Search the first ~600 chars (FOUC is always at the top)
        head = html[:1500]
        fouc_ok = (
            "ht.theme" in head
            and ("localStorage.getItem" in head or "HT.storage" in head)
        )
        check(fouc_ok, f"{index_html}: includes FOUC IIFE inline at the top (AD-15)")
    else:
        check(False, f"{index_html}: FOUC IIFE check [file missing]")

    # 6. data.json has `questions` array of length 3..30
    if isinstance(data, dict):
        questions = data.get("questions")
        if isinstance(questions, list) and 3 <= len(questions) <= 30:
            check(True, "data.json has questions[] of length 3..30")
        else:
            check(
                False,
                f"data.json has questions[] of length 3..30 (got {type(questions).__name__} len={len(questions) if isinstance(questions, list) else 'n/a'})",
            )
    else:
        check(False, "data.json has questions[] of length 3..30 [data missing]")

    # 7. data.json has scoring-spec with traits[], weights{}, archetypes[]
    if isinstance(data, dict):
        spec = data.get("scoring-spec")
        ok = (
            isinstance(spec, dict)
            and isinstance(spec.get("traits"), list)
            and isinstance(spec.get("weights"), dict)
            and isinstance(spec.get("archetypes"), list)
        )
        check(ok, "data.json has scoring-spec with traits[], weights{}, archetypes[]")
    else:
        check(False, "data.json has scoring-spec with traits[], weights{}, archetypes[] [data missing]")

    # 8. <slug>-core.js calls HT.quiz.open(
    core_src = read_text(core_js) or ""
    if core_src:
        check(
            "HT.quiz.open(" in core_src,
            f"{slug}-core.js calls HT.quiz.open(...)",
        )
    else:
        check(False, f"{slug}-core.js calls HT.quiz.open(...) [file missing]")


def main():
    print("DC-6 — 10 per-quiz routes (8 checks × 10 quizzes = ~80 PASS)")

    slugs = find_quiz_slugs()
    if not slugs:
        # DC-6 depends on DC-7 having registered the 10 entry slugs
        # in tools.json. Until DC-7 lands, emit ONE summary FAIL
        # and exit — no point enumerating 80 placeholder checks that
        # don't carry information beyond "DC-7 hasn't shipped yet".
        check(
            False,
            "no Discovery quiz slugs found in tools.json — DC-7 must land first "
            "(the per-quiz checks run as soon as packs.discovery.entries[] is populated)",
        )
        return exit_with_summary("DC-6")

    if len(slugs) != 10:
        # Plan says 10 quizzes; a future contributor who adds an 11th
        # gets a soft warning. The gate doesn't fail on this alone —
        # we still try to check every slug we found.
        print(f"  WARN  expected 10 quiz slugs, found {len(slugs)}")

    for slug in slugs:
        check_one_quiz(slug)

    exit_with_summary("DC-6")


if __name__ == "__main__":
    main()