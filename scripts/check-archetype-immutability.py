#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-archetype-immutability.py — Archetype immutability lint (FR-31).

Scans packs/disc/**/*.json for placeholder syntax that would indicate
user input is being interpolated into an archetype label, blind-spot
text, or share-card copy. Archetypes are author-declared strings; any
user-derived text in an archetype is a privacy + integrity violation.

Patterns:
  {{...}}        — Mustache-style placeholders
  {user.name}    — dot-notation user refs
  {answers.q1}   — answer-value refs

Brownfield-safe: only files under packs/disc/ are scanned. The
existing 50 tool entries live under tools/ and are untouched.

Pure stdlib. No third-party deps.

Exit codes:
  0 — no placeholders detected
  1 — at least one placeholder match
  2 — usage / setup error
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


# {{anything}} — Mustache / Jinja-style template placeholders
PLACEHOLDER_DOUBLE_RE = re.compile(r"\{\{[^}]+\}\}")
# {user.<name>} or {answers.<id>} — dot-notation user-derived refs.
# Conservative: only matches `user.*` and `answers.*` prefixes since
# those are the documented templates; anything else is caught by
# PLACEHOLDER_DOUBLE_RE.
PLACEHOLDER_DOT_RE    = re.compile(r"\{(?:user|answers)\.[A-Za-z_][A-Za-z0-9_]*\}")


def walk_strings(obj, path=()):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, path + (str(k),))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, path + (f"[{i}]",))
    elif isinstance(obj, str):
        yield (path, obj)


def scan_file(json_path):
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        return [(("<read-error>",), str(e), str(json_path))]
    matches = []
    for path, value in walk_strings(data):
        for m in PLACEHOLDER_DOUBLE_RE.finditer(value):
            matches.append((path, "double-curly", m.group(0)))
        for m in PLACEHOLDER_DOT_RE.finditer(value):
            matches.append((path, "dot-ref", m.group(0)))
    return matches


def main():
    repo = Path(__file__).resolve().parent.parent
    disc_dir = repo / "packs" / "disc"
    # Allow the lint to be exercised against a sandboxed fixture
    # (DC-12 negative-fixture check) by falling back to `<cwd>/packs/disc`
    # when the script's own repo has none. Brownfield-safe: production
    # always uses the script's own repo.
    cwd = Path.cwd()
    if not disc_dir.is_dir() and (cwd / "packs" / "disc").is_dir():
        repo = cwd
        disc_dir = repo / "packs" / "disc"

    if not disc_dir.is_dir():
        # No packs/disc yet — vacuous pass. Activates when Story 10.7
        # lands 6 quiz entries.
        print(f"check-archetype-immutability: packs/disc/ not found — vacuous pass")
        print("JSON:{\"story\": \"DC-12-IMMUTABILITY\", \"pass\": 1, \"fail\": 0}")
        sys.exit(0)

    total_fail = 0
    scanned = 0
    for json_path in sorted(disc_dir.rglob("*.json")):
        scanned += 1
        for path, kind, matched in scan_file(json_path):
            total_fail += 1
            print(
                f"  FAIL  placeholder({kind}) in {json_path.relative_to(repo)} :: "
                f"{'.'.join(path)}: {matched!r}"
            )

    if total_fail == 0:
        print(f"check-archetype-immutability: scanned {scanned} file(s), 0 placeholders")
        print(f"JSON:{{\"story\": \"DC-12-IMMUTABILITY\", \"pass\": 1, \"fail\": {total_fail}}}")
        sys.exit(0)
    else:
        print(f"check-archetype-immutability: scanned {scanned} file(s), {total_fail} placeholder(s)")
        print(f"JSON:{{\"story\": \"DC-12-IMMUTABILITY\", \"pass\": 0, \"fail\": {total_fail}}}")
        sys.exit(1)


if __name__ == "__main__":
    main()