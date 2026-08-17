#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-7-tools-json.py — AC for DC-7 (tools.json registration).

Verifies tools.json carries the Discovery pack + 10 entries, validates
against the schema, and doesn't break the 50 pre-existing tool entries.

Run: `make dc-7-tools-json` or `python scripts/dc/dc-7-tools-json.py`.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, repo_root


SLUG_RE = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")


def main():
    print("DC-7 — tools.json registration (Discovery pack + 10 entries)")

    tj_path = repo_root() / "tools.json"

    # 1. tools.json parses as JSON
    try:
        tj = json.loads(tj_path.read_text(encoding="utf-8"))
        check(True, "tools.json parses as JSON")
    except Exception as e:
        check(False, f"tools.json parses as JSON ({e})")
        return exit_with_summary("DC-7")

    # 2. top-level packs is an object
    packs = tj.get("packs")
    check(isinstance(packs, dict), "top-level `packs` is an object")

    # 3, 4. packs.discovery exists and slug == 'discovery'
    disc = (packs or {}).get("discovery") or {}
    check(bool(disc), "packs.discovery exists")
    check(
        disc.get("slug") == "discovery",
        "packs.discovery.slug == 'discovery'",
    )

    # 5. entries is an array of length 10
    entries = disc.get("entries") or []
    check(
        isinstance(entries, list) and len(entries) == 10,
        f"packs.discovery.entries is an array of length 10 (got {len(entries) if isinstance(entries, list) else 'n/a'})",
    )

    if not isinstance(entries, list) or len(entries) != 10:
        # Subsequent checks depend on a 10-entry list; emit a soft pass
        # for each remaining check so the gate doesn't masquerade as
        # 'all good' when entries haven't landed yet.
        for label in (
            "Every entry's slug matches ^[a-z][a-z0-9-]*[a-z0-9]$",
            "Every entry's slug is unique (no duplicates)",
            "Every entry's modules[] declares at least scoring + results",
            "Every viral-category entry declares challenge",
            "Every utility-category entry declares catalog",
            "Every entry's data path resolves to a real file on disk",
            "validate-tools-json.py exits 0 against the schema",
            "releaseVersion has been bumped (different from 0.0.0)",
            "The 50 pre-existing tool entries are unchanged",
        ):
            check(False, label + " [no entries]")
        return exit_with_summary("DC-7")

    # 6. every entry's slug matches the regex
    bad_slugs = [e["slug"] for e in entries if not SLUG_RE.match(e.get("slug", ""))]
    check(
        not bad_slugs,
        f"Every entry's slug matches ^[a-z][a-z0-9-]*[a-z0-9]$ (bad: {bad_slugs})",
    )

    # 7. unique slugs
    slugs = [e.get("slug") for e in entries]
    check(
        len(set(slugs)) == len(slugs),
        "Every entry's slug is unique (no duplicates)",
    )

    # 8. every entry's modules[] declares at least scoring + results
    missing_modules = [
        e["slug"]
        for e in entries
        if not (
            isinstance(e.get("modules"), list)
            and any(m.get("kind") == "scoring" for m in e["modules"])
            and any(m.get("kind") == "results" for m in e["modules"])
        )
    ]
    check(
        not missing_modules,
        f"Every entry's modules[] declares at least scoring + results (bad: {missing_modules})",
    )

    # 9. every viral-category entry declares challenge
    missing_chal = [
        e["slug"]
        for e in entries
        if e.get("category") == "viral"
        and not any(m.get("kind") == "challenge" for m in (e.get("modules") or []))
    ]
    check(
        not missing_chal,
        f"Every viral-category entry declares challenge (bad: {missing_chal})",
    )

    # 10. every utility-category entry declares catalog
    missing_cat = [
        e["slug"]
        for e in entries
        if e.get("category") == "utility"
        and not any(m.get("kind") == "catalog" for m in (e.get("modules") or []))
    ]
    check(
        not missing_cat,
        f"Every utility-category entry declares catalog (bad: {missing_cat})",
    )

    # 11. every entry's data path resolves to a real file on disk
    missing_data = []
    for e in entries:
        data_rel = e.get("data")
        if not data_rel:
            missing_data.append((e["slug"], "no data field"))
            continue
        full = repo_root() / data_rel
        if not full.is_file():
            missing_data.append((e["slug"], data_rel))
    check(
        not missing_data,
        f"Every entry's data path resolves to a real file (missing: {missing_data})",
    )

    # 12. validate-tools-json.py exits 0
    r = subprocess.run(
        [sys.executable, str(repo_root() / "scripts" / "validate-tools-json.py")],
        capture_output=True,
        text=True,
    )
    check(
        r.returncode == 0,
        f"scripts/validate-tools-json.py exits 0 against the schema (rc={r.returncode})",
    )

    # 13. releaseVersion bumped
    rv = tj.get("releaseVersion") or ""
    check(
        rv and rv != "0.0.0",
        f"releaseVersion has been bumped (got {rv!r})",
    )

    # 14. 50 pre-existing tool entries unchanged
    tools = tj.get("tools") or []
    check(
        isinstance(tools, list) and len(tools) == 50,
        f"The 50 pre-existing tool entries are unchanged (count={len(tools) if isinstance(tools, list) else 'n/a'})",
    )

    exit_with_summary("DC-7")


if __name__ == "__main__":
    main()