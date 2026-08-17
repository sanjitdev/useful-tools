#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-pack-composition.py — Story 9.16 / 9.17 pack-composition gate.

Reads tools.json and asserts:

Story 9.16 (Travel pack):
  - `travel` pack contains EXACTLY these 5 tools, no more, no less:
    currency-converter, tip-calculator, unit-converter, recipe-scaler, exam-countdown

Story 9.17 (Finance / Study / Developer / Household packs):
  - finance pack has ≥ 5 ready:true tools
  - study pack has ≥ 5 ready:true tools
  - developer pack has ≥ 5 ready:true tools
  - household pack has ≥ 5 ready:true tools

Taxonomy:
  - no tool has a `pack` value not in the enum
    {travel, finance, study, developer, household, fun}

Pure-stdlib Python. No third-party deps.

Usage:
    python scripts/check-pack-composition.py            # gate run

Exit codes:
    0 — every check passes
    2 — missing required member (AC violation: e.g. travel missing a tool)
    3 — vacuous run (no tools to check)
    4 — taxonomy violation (pack value not in enum)
    5 — below-minimum pack size (e.g. finance has < 5 ready tools)
"""
from __future__ import annotations

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

# Story 9.16: the canonical Travel pack roster. Order matters for the
# diagnostic output but the set comparison is unordered.
TRAVEL_PACK_REQUIRED: tuple[str, ...] = (
    "currency-converter",
    "tip-calculator",
    "unit-converter",
    "recipe-scaler",
    "exam-countdown",
)

# Story 9.17: minimum ready:true tool counts per curated pack.
PACK_MIN_SIZE: dict[str, int] = {
    "finance": 5,
    "study": 5,
    "developer": 5,
    "household": 5,
}

# Mirrored from tools.schema.json pack.items.enum.
PACK_ENUM: frozenset[str] = frozenset({
    "travel", "finance", "study", "developer", "household", "fun"
})


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"check-pack-composition: cannot locate {SCHEMA_FILENAME} in {cur} "
        f"or any ancestor.\n"
    )
    sys.exit(2)


def load_tools(root: Path) -> list[dict]:
    tools_path = root / TOOLS_JSON_FILENAME
    if not tools_path.is_file():
        sys.stderr.write(
            f"check-pack-composition: missing {tools_path}\n"
        )
        sys.exit(2)
    try:
        payload = json.loads(tools_path.read_text(encoding="utf-8"))
    except OSError as exc:
        sys.stderr.write(
            f"check-pack-composition: cannot read {tools_path}: {exc}\n"
        )
        sys.exit(3)
    except ValueError as exc:
        sys.stderr.write(
            f"check-pack-composition: {tools_path} is not valid JSON: {exc}\n"
        )
        sys.exit(2)
    if not isinstance(payload, dict) or "tools" not in payload:
        sys.stderr.write(
            "check-pack-composition: tools.json must be an object with a "
            "'tools' array\n"
        )
        sys.exit(2)
    tools = payload["tools"]
    if not isinstance(tools, list):
        sys.stderr.write(
            "check-pack-composition: tools.json 'tools' must be an array\n"
        )
        sys.exit(2)
    return tools


def by_pack(tools: list[dict]) -> dict[str, list[str]]:
    """Return {pack_slug: [tool_slug, ...]} for every pack that has
    ≥ 1 tool. Only includes ready:true tools with non-empty pack arrays."""
    out: dict[str, list[str]] = {}
    for t in tools:
        if not isinstance(t, dict) or t.get("ready") is not True:
            continue
        slug = t.get("slug")
        if not isinstance(slug, str):
            continue
        packs = t.get("pack") or []
        if not isinstance(packs, list):
            continue
        for p in packs:
            if not isinstance(p, str):
                continue
            out.setdefault(p, []).append(slug)
    return out


def main() -> int:
    root = find_repo_root(Path(__file__).parent)
    tools = load_tools(root)

    if not any(isinstance(t, dict) and t.get("ready") is True for t in tools):
        sys.stderr.write(
            "check-pack-composition: no ready:true tools to check "
            "— vacuous run\n"
        )
        return 3

    # ---------------------------------------------------------------
    # Taxonomy check: no tool has a pack value outside the enum.
    # ---------------------------------------------------------------
    taxonomy_failures: list[str] = []
    for t in tools:
        if not isinstance(t, dict):
            continue
        packs = t.get("pack") or []
        if not isinstance(packs, list):
            continue
        for p in packs:
            if not isinstance(p, str):
                continue
            if p not in PACK_ENUM:
                slug = t.get("slug", "<unknown>")
                taxonomy_failures.append(f"{slug}: pack {p!r} not in taxonomy")
    if taxonomy_failures:
        for line in taxonomy_failures:
            sys.stderr.write(f"check-pack-composition: {line}\n")
        return 4

    # ---------------------------------------------------------------
    # Build the pack roster (ready:true only).
    # ---------------------------------------------------------------
    roster = by_pack(tools)
    total_ready = sum(1 for t in tools if isinstance(t, dict) and t.get("ready") is True)

    # ---------------------------------------------------------------
    # Story 9.16: Travel pack must contain EXACTLY the 5 required tools.
    # ---------------------------------------------------------------
    travel_set = set(roster.get("travel", []))
    required_set = set(TRAVEL_PACK_REQUIRED)
    missing = required_set - travel_set
    extra = travel_set - required_set
    if missing or extra:
        sys.stderr.write("check-pack-composition: travel pack composition failed\n")
        if missing:
            sys.stderr.write(
                f"  missing required: {sorted(missing)}\n"
            )
        if extra:
            sys.stderr.write(
                f"  extra (must remove `travel` from): {sorted(extra)}\n"
            )
        sys.stderr.write(
            f"  required (in order): {list(TRAVEL_PACK_REQUIRED)}\n"
        )
        sys.stderr.write(
            f"  current travel: {sorted(travel_set)}\n"
        )
        return 2

    # ---------------------------------------------------------------
    # Story 9.17: minimum ready:true counts per curated pack.
    # ---------------------------------------------------------------
    for pack_slug, minimum in PACK_MIN_SIZE.items():
        members = roster.get(pack_slug, [])
        if len(members) < minimum:
            sys.stderr.write(
                f"check-pack-composition: pack {pack_slug!r} has "
                f"{len(members)} ready tools (< {minimum} minimum): "
                f"{members}\n"
            )
            return 5

    # ---------------------------------------------------------------
    # Diagnostic summary.
    # ---------------------------------------------------------------
    print(f"check-pack-composition: {total_ready} ready tools across "
          f"{len(roster)} pack(s)")
    for pack_slug in sorted(roster):
        members = roster[pack_slug]
        print(f"  {pack_slug:11s} {len(members):>2d} tool(s): {sorted(members)}")
    print("check-pack-composition: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main())