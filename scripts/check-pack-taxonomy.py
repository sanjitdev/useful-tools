#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-pack-taxonomy.py — Story 6.3 pack-taxonomy suggestion script.

Reads tools.json and posts a *suggestion* (not a gate) for any
`ready:true` entry whose `pack` field is missing or not in the
curated allowlist {travel, finance, study, developer, household}.
The schema (tools.schema.json) is the authoritative gate; this script
complements it by recommending a pack based on a hand-rolled
keyword-to-pack map scanned across each tool's `category` and
`keywords` fields.

Pure-stdlib Python. No third-party deps.

Usage:
    python scripts/check-pack-taxonomy.py            # read + suggest
    python scripts/check-pack-taxonomy.py --quiet    # only print suggestions

Exit codes:
    0 — every tool's pack is valid (script ran cleanly; suggestions
        may have been printed for tools with sub-optimal tags — that
        is not a failure)
    2 — repo layout issue (schema or tools.json missing or malformed)
    3 — I/O failure (read/write error on tools.json or schema)

Notes:
  - This script NEVER exits 1 by design. The schema is the gate; the
    suggestion is informational. A vacuous run (0 tools processed)
    exits 3 with a clear message (the project's no-hollow-runs
    convention).
  - The KEYWORD_TO_PACK map is hand-rolled and auditable in PR review.
    It is not learned — a learned model would silently change
    recommendations on every run, violating the "explicit, not
    vibes-based" AC.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"

# Curated pack allowlist. Mirrored from tools.schema.json pack.items.enum.
# Story 6.3 keeps this list colocated with the script for clarity —
# any drift here vs. the schema is a PR review flag.
PACK_ALLOWLIST = ("travel", "finance", "study", "developer", "household")

# Hand-rolled keyword → pack map. Lowercase substring scan against each
# tool's `category` + `keywords` fields. First match wins; the order
# below is intentional (more specific keys before general ones).
#
# Rule: ≥ 3 keywords per pack, mapped to the INCLUSION_CRITERIA bullets
# from `scripts/_pack_tags.py`. Adding a new keyword requires a doc
# update so the audit trail stays explicit.
KEYWORD_TO_PACK: list[tuple[str, str]] = [
    # travel
    ("currency", "travel"),
    ("timezone", "travel"),
    ("time zone", "travel"),
    ("countdown", "travel"),
    ("date difference", "travel"),
    ("world clock", "travel"),
    # finance
    ("loan", "finance"),
    ("emi", "finance"),
    ("interest", "finance"),
    ("tax", "finance"),
    ("tip", "finance"),
    ("inflation", "finance"),
    ("percentage", "finance"),
    ("discount", "finance"),
    # study
    ("grade", "study"),
    ("gpa", "study"),
    ("focus", "study"),
    ("pomodoro", "study"),
    ("stopwatch", "study"),
    ("word counter", "study"),
    ("lorem", "study"),
    ("lifespan", "study"),
    # developer
    ("json", "developer"),
    ("regex", "developer"),
    ("encoding", "developer"),
    ("base64", "developer"),
    ("url", "developer"),
    ("password", "developer"),
    ("qr code", "developer"),
    ("uuid", "developer"),
    ("random", "developer"),
    ("markdown", "developer"),
    ("unit converter", "developer"),
    # household
    ("bmi", "household"),
    ("calorie", "household"),
    ("habit", "household"),
    ("age calculator", "household"),
    ("decision", "household"),
    ("eisenhower", "household"),
    ("color", "household"),
    ("space calculator", "household"),
    ("paint", "household"),
    ("grocery", "household"),
    ("recipe", "household"),
    ("animal", "household"),
]


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"check-pack-taxonomy: cannot locate {SCHEMA_FILENAME} in {cur} "
        f"or any ancestor.\n"
    )
    sys.exit(2)


def load_tools(root: Path) -> list[dict]:
    """Load tools.json. Returns the list of tool entries. Exits 2 on
    a layout issue, 3 on I/O failure."""
    tools_path = root / TOOLS_JSON_FILENAME
    if not tools_path.is_file():
        sys.stderr.write(
            f"check-pack-taxonomy: missing {tools_path}\n"
        )
        sys.exit(2)
    try:
        payload = json.loads(tools_path.read_text(encoding="utf-8"))
    except OSError as exc:
        sys.stderr.write(
            f"check-pack-taxonomy: cannot read {tools_path}: {exc}\n"
        )
        sys.exit(3)
    except ValueError as exc:
        sys.stderr.write(
            f"check-pack-taxonomy: {tools_path} is not valid JSON: {exc}\n"
        )
        sys.exit(2)
    if not isinstance(payload, dict) or "tools" not in payload:
        sys.stderr.write(
            "check-pack-taxonomy: tools.json must be an object with a "
            "'tools' array\n"
        )
        sys.exit(2)
    tools = payload["tools"]
    if not isinstance(tools, list):
        sys.stderr.write(
            "check-pack-taxonomy: tools.json 'tools' must be an array\n"
        )
        sys.exit(2)
    return tools


def guess_pack(tool: dict) -> tuple[str | None, str | None]:
    """Scan a tool's category + keywords for the first KEYWORD_TO_PACK
    match (case-insensitive substring). Returns (guessed_pack, matched_keyword)
    or (None, None) if no match is found."""
    haystacks: list[str] = []
    category = tool.get("category")
    if isinstance(category, str):
        haystacks.append(category.lower())
    keywords = tool.get("keywords")
    if isinstance(keywords, list):
        for kw in keywords:
            if isinstance(kw, str):
                haystacks.append(kw.lower())
    if not haystacks:
        return (None, None)
    for needle, pack in KEYWORD_TO_PACK:
        for hay in haystacks:
            if needle in hay:
                return (pack, needle)
    return (None, None)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Story 6.3 — Suggest a pack for tools with missing "
                    "or invalid pack tags. Not a gate."
    )
    parser.add_argument(
        "--quiet", action="store_true",
        help="Suppress the per-tool suggestion lines; only print summary."
    )
    args = parser.parse_args()

    root = find_repo_root(Path(__file__).parent)
    tools = load_tools(root)

    ready = [t for t in tools if isinstance(t, dict) and t.get("ready") is True]
    if not ready:
        sys.stderr.write(
            "check-pack-taxonomy: no tools to check (0 ready:true entries) "
            "— vacuous run\n"
        )
        return 3

    suggestions = 0
    for tool in ready:
        slug = tool.get("slug", "<unknown>")
        pack_field = tool.get("pack")
        current = (
            ",".join(pack_field)
            if isinstance(pack_field, list)
            else (pack_field if pack_field is not None else "<missing>")
        )
        needs_suggest = (
            not isinstance(pack_field, list)
            or not pack_field
            or any(p not in PACK_ALLOWLIST for p in pack_field)
        )
        if not needs_suggest:
            continue
        guessed, matched = guess_pack(tool)
        suggestions += 1
        if not args.quiet:
            matched_repr = f'"{matched}"' if matched else "<no keyword match>"
            guessed_repr = guessed if guessed else "<no guess>"
            print(
                f"  {slug}: pack={current}; "
                f"suggested={guessed_repr} (matched: {matched_repr})"
            )

    if not args.quiet:
        print(
            f"check-pack-taxonomy: {len(ready)} tools checked, "
            f"{suggestions} suggestions"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())