#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pack-gate.py — Application-layer enforcement of the Discovery Pack contract.

Pure-stdlib Python. Mirrors the shape of scripts/tool-contract-gate.py:
no third-party deps, exit codes 0/1/2, Markdown report on stdout.

Purpose
-------
Walk every entry in `tools.json → packs.discovery.entries[]` and assert
the contract fields every quiz must satisfy (Story 10.1 schema + DC-7
AC). The rubric doc is the source of truth; this script reproduces the
truth table so the gate can run in CI without the linter.

Usage
-----
  python scripts/pack-gate.py                       # run the gate
  python scripts/pack-gate.py --list                # print the contract
  python scripts/pack-gate.py --root ...            # explicit repo root
  python scripts/pack-gate.py --tools-json <path>   # alternate tools.json

Exit codes
----------
  0 — every entry in packs.discovery.entries[] passes the contract
  1 — at least one entry fails (missing slug / title / category / data /
      modules / questions-length)
  2 — tools.json missing or unparseable

Report format
-------------
  Markdown summary + per-entry table: `slug · category · title-len ·
  data-path · modules · questions · outcome`. One row per entry.

Author: Handy Tools (Story 10.18 — pack composition / DC-10 gate)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

# Force UTF-8 on stdout/stderr so the Markdown report renders correctly on
# Windows consoles (cp1252) without crashing on ≥ / ✗ / ✓ / non-ASCII quotes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass


SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"

# ---- Contract constants ----

SLUG_RE = re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")
ALLOWED_CATEGORIES = ("viral", "utility")
REQUIRED_MODULE_KINDS = ("scoring", "results")
UTILITY_EXTRA_MODULES = ("catalog",)


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing
    tools.schema.json. Raises SystemExit if no such directory exists."""
    try:
        cur = start.resolve()
    except OSError as e:
        sys.stderr.write(f"pack-gate: cannot resolve {start}: {e}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_FILENAME).is_file():
            return parent
    sys.stderr.write(
        f"pack-gate: cannot locate {SCHEMA_FILENAME} in {cur} "
        "or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    """Load JSON; BOM-tolerant; raise with file path on error."""
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"pack-gate: cannot read {path}: {e}\n")
        sys.exit(2)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"pack-gate: invalid JSON in {path}: {e}\n")
        sys.exit(2)


# ---------------------------------------------------------------------------
# Outcome strings (kept short so the Markdown table stays compact)
# ---------------------------------------------------------------------------

OUTCOME_PASS = "PASS"
OUTCOME_FAIL = "FAIL"


# ---------------------------------------------------------------------------
# Per-entry evaluation
# ---------------------------------------------------------------------------

def _entry_module_kinds(entry: dict) -> list[str]:
    """Extract the {kind: string} values from entry.modules[]."""
    mods = entry.get("modules")
    if not isinstance(mods, list):
        return []
    out: list[str] = []
    for m in mods:
        if isinstance(m, dict) and isinstance(m.get("kind"), str):
            out.append(m["kind"])
    return out


def _questions_length_from_data(data_root: Path, slug: str, data_path: str) -> int | None:
    """Read the entry's data.json file (if reachable) and return the number
    of questions it declares. Returns None if the file is missing or the
    questions array is malformed (so the gate can surface a distinct FAIL)."""
    if not data_path:
        return None
    # data paths are relative to the repo root (./tools/packs/discovery/<slug>/data.json)
    rel = data_path.lstrip("./").lstrip("/")
    p = data_root / rel
    if not p.is_file():
        return None
    try:
        obj = json.loads(p.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    qs = obj.get("questions") if isinstance(obj, dict) else None
    if not isinstance(qs, list):
        return None
    return len(qs)


def _evaluate_entry(entry: Any, data_root: Path) -> tuple[str, list[str]]:
    """Apply the pack contract to one entry. Returns (outcome, notes)."""
    notes: list[str] = []
    if not isinstance(entry, dict):
        return OUTCOME_FAIL, ["entry is not an object"]

    slug = entry.get("slug")
    if not isinstance(slug, str) or not SLUG_RE.match(slug):
        notes.append(f"slug must match ^[a-z][a-z0-9-]*[a-z0-9]$ (got {slug!r})")

    title = entry.get("title")
    if not isinstance(title, str) or not title.strip():
        notes.append("title must be a non-empty string")

    category = entry.get("category")
    if category not in ALLOWED_CATEGORIES:
        notes.append(
            f"category must be one of {ALLOWED_CATEGORIES} (got {category!r})"
        )

    data = entry.get("data")
    if not isinstance(data, str) or not data.strip():
        notes.append("data must be a non-empty string (path to data.json)")
    elif isinstance(slug, str) and SLUG_RE.match(slug):
        expected_prefix = "./tools/packs/discovery/" + slug + "/data.json"
        if data != expected_prefix:
            notes.append(
                f"data path must be {expected_prefix!r} (got {data!r})"
            )

    modules = entry.get("modules")
    if not isinstance(modules, list) or len(modules) == 0:
        notes.append("modules[] must be a non-empty array")
    else:
        kinds = _entry_module_kinds(entry)
        for required in REQUIRED_MODULE_KINDS:
            if required not in kinds:
                notes.append(f"modules[] must declare kind='{required}'")
        if category == "utility":
            for extra in UTILITY_EXTRA_MODULES:
                if extra not in kinds:
                    notes.append(
                        f"utility-category entries must also declare kind='{extra}'"
                    )

    # Read questions-length from the on-disk data.json (best-effort).
    if isinstance(slug, str) and isinstance(data, str):
        qcount = _questions_length_from_data(data_root, slug, data)
        if qcount is None:
            notes.append(
                f"could not read questions[] from on-disk {data} (file missing or malformed)"
            )
        elif not (3 <= qcount <= 30):
            notes.append(
                f"questions[] must have length 3..30 (got {qcount})"
            )

    return (OUTCOME_PASS if not notes else OUTCOME_FAIL), notes


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def _render_report(rows: list[dict], summary: dict[str, int]) -> None:
    print("# Pack Gate — Discovery Pack Contract Report")
    print()
    print(f"- pass: **{summary['pass']}**")
    print(f"- fail: **{summary['fail']}**")
    if summary["fail"] == 0:
        print()
        print("**PASS:** every entry in `packs.discovery.entries[]` satisfies the contract.")
    else:
        print()
        print("**FAIL:** at least one entry violates the contract.")
    print()
    print("| slug | category | modules | questions | outcome | notes |")
    print("| --- | --- | --- | --- | --- | --- |")
    for r in rows:
        notes = "; ".join(r["notes"]) if r["notes"] else "—"
        print(
            f"| `{r['slug']}` | {r['category']} | {r['modules']} | {r['questions']} "
            f"| **{r['outcome']}** | {notes} |"
        )


def _print_contract() -> None:
    print("pack-gate: verifies packs.discovery.entries[N] contract — exit 0=clean, 1=at least one entry violates (missing slug/title/category/data/modules or questions out of [3..30])")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Pack Gate — application-layer enforcement of the Discovery Pack contract.",
    )
    parser.add_argument("--list", action="store_true", help="Print the gate's contract and exit.")
    parser.add_argument("--root", default=None, help="Path to repo root (auto-detected if omitted).")
    parser.add_argument("--tools-json", default=None, help="Alternate path to tools.json (overrides --root).")
    args = parser.parse_args(argv)

    if args.list:
        _print_contract()
        return 0

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)

    if args.tools_json:
        tools_json_path = Path(args.tools_json).resolve()
    else:
        tools_json_path = root / TOOLS_JSON_FILENAME

    data = load_json(tools_json_path)
    if not isinstance(data, dict):
        sys.stderr.write("pack-gate: tools.json must be a JSON object at the top level.\n")
        return 2

    packs = data.get("packs")
    if not isinstance(packs, dict):
        sys.stderr.write("pack-gate: tools.json must have a `packs` object.\n")
        return 2

    disc = packs.get("discovery")
    if not isinstance(disc, dict):
        sys.stderr.write("pack-gate: tools.json must have `packs.discovery` as an object.\n")
        return 2

    entries = disc.get("entries")
    if not isinstance(entries, list):
        sys.stderr.write("pack-gate: packs.discovery.entries must be an array.\n")
        return 2

    rows: list[dict] = []
    for entry in entries:
        slug = entry.get("slug", "?") if isinstance(entry, dict) else "?"
        outcome, notes = _evaluate_entry(entry, root)
        modules = _entry_module_kinds(entry) if isinstance(entry, dict) else []
        qcount = "?"
        if isinstance(entry, dict) and isinstance(entry.get("data"), str) and isinstance(entry.get("slug"), str):
            computed = _questions_length_from_data(root, entry["slug"], entry["data"])
            qcount = computed if computed is not None else "?"
        rows.append({
            "slug": slug,
            "category": entry.get("category", "?") if isinstance(entry, dict) else "?",
            "modules": ",".join(modules) if modules else "—",
            "questions": qcount,
            "outcome": outcome,
            "notes": notes,
        })

    summary = {
        "pass": sum(1 for r in rows if r["outcome"] == OUTCOME_PASS),
        "fail": sum(1 for r in rows if r["outcome"] == OUTCOME_FAIL),
    }
    _render_report(rows, summary)

    return 0 if summary["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())