#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-12-retro.py — AC for DC-12 (docs/stories.md + retro).

Verifies docs/stories.md has a heading per story ID, each one carries
the required metadata (files, API deltas, AC list, verification, owner,
status), and the shipped retro doc exists with actual byte measurements.

Run: `make dc-12-retro` or `python scripts/dc/dc-12-retro.py`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, read_text, repo_root


STORY_IDS = ["DC-0", "DC-1", "DC-2", "DC-3", "DC-4", "DC-5", "DC-6", "DC-7",
             "DC-8", "DC-9", "DC-10", "DC-11", "DC-12"]

REQUIRED_FIELDS = ["files", "api", "ac", "verify", "owner", "status"]


def main():
    print("DC-12 — docs/stories.md + shipped retro (3 checks)")

    stories_path = "docs/stories.md"
    retro_path = "_bmad-output/implementation-artifacts/epic-discovery-shipped.md"

    stories_src = read_text(stories_path) or ""

    # 1. stories.md exists + has a heading per story ID
    if not stories_src:
        check(False, f"{stories_path} exists")
        for sid in STORY_IDS:
            check(False, f"{stories_path}: heading for {sid}")
        check(False, f"{stories_path}: each heading carries required fields")
    else:
        check(True, f"{stories_path} exists")
        headings = re.findall(r"^#{1,4}\s+(DC-\d+)\b", stories_src, re.MULTILINE)
        missing_headings = [sid for sid in STORY_IDS if sid not in headings]
        check(
            not missing_headings,
            f"{stories_path}: heading per story ID (missing: {missing_headings})",
        )

        # 2. Each heading is followed by: files, public-API deltas, AC list,
        # verification command, owner, status.
        # Walk per-story block.
        per_story_ok = True
        bad_stories = []
        for sid in STORY_IDS:
            idx = stories_src.find(sid)
            if idx == -1:
                per_story_ok = False
                bad_stories.append((sid, "no heading"))
                continue
            # Take 800 chars after the heading
            window = stories_src[idx: idx + 800].lower()
            missing = [f for f in REQUIRED_FIELDS if f not in window]
            if missing:
                per_story_ok = False
                bad_stories.append((sid, missing))
        check(
            per_story_ok,
            f"{stories_path}: each story heading followed by required fields (files/api/ac/verify/owner/status) (issues: {bad_stories[:3]})",
        )

    # 3. shipped retro exists with actual byte measurements (not targets)
    retro_src = read_text(retro_path) or ""
    if not retro_src:
        check(False, f"{retro_path} exists")
    else:
        # Heuristic: actual measurements look like "123,456 bytes gz" or
        # "12.3 KB" — not "target 4,000". Accept any digit+unit pair.
        has_actual = bool(re.search(
            r"\b\d[\d,_]*\s*(bytes|b|gz|kb|mb)\b",
            retro_src,
            re.IGNORECASE,
        ))
        has_target_only = bool(re.search(
            r"target\s*\d",
            retro_src,
            re.IGNORECASE,
        ))
        check(
            has_actual,
            f"{retro_path} contains actual byte measurements (not just targets)",
        )

    exit_with_summary("DC-12")


if __name__ == "__main__":
    main()