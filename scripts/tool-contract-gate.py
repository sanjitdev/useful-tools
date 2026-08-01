#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tool-contract-gate.py — Application-layer enforcement of the Tool Contract.

Pure-stdlib Python. Mirrors the shape of scripts/validate-tools-json.py and
scripts/rubric-lint.py: no third-party deps, exit codes 0/1/2/3, Markdown
report on stdout.

Purpose
-------
Walk every entry in tools.json and apply the gate truth table from
docs/quality-rubric.md#Scoring & Gate. The rubric doc is the source of
truth; this script reproduces the table so the gate can run in CI without
the linter. The persisted `score` field is the authoritative reviewed
score (a human set it after the manual phase). The linter's mechanical
output is informational and not re-run here.

Usage
-----
  python scripts/tool-contract-gate.py            # run the gate
  python scripts/tool-contract-gate.py --list     # print the contract
  python scripts/tool-contract-gate.py --root ... # explicit repo root

Exit codes
----------
  0 — all entries pass (or all sub-8 are under unexpired waivers)
  1 — at least one entry fails the gate (MISMATCH / FAIL / EXPIRED)
  2 — tools.json missing or unparseable
  3 — schema-invalid (e.g., a score-waiver missing a required field)

Report format
-------------
  Markdown table grouped by outcome: PASS, WAIVER, then FAIL/MISMATCH/
  EXPIRED. One row per entry: `slug · score · ready · waiver · outcome`.

Author: Handy Tools (Story 1.3 — Tool Contract CI Gate)
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

# ---------------------------------------------------------------------------
# Path handling (same walk-up pattern as validate-tools-json.py)
# ---------------------------------------------------------------------------

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing
    tools.schema.json. Raises SystemExit if no such directory exists."""
    try:
        cur = start.resolve()
    except OSError as e:
        sys.stderr.write(f"tool-contract-gate: cannot resolve {start}: {e}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_FILENAME).is_file():
            return parent
    sys.stderr.write(
        f"tool-contract-gate: cannot locate {SCHEMA_FILENAME} in {cur} "
        "or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    """Load JSON; BOM-tolerant; raise with file path on error."""
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"tool-contract-gate: cannot read {path}: {e}\n")
        sys.exit(2)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"tool-contract-gate: invalid JSON in {path}: {e}\n")
        sys.exit(2)


# ---------------------------------------------------------------------------
# SemVer comparison (intentionally minimal — only the subset tools.json uses)
# ---------------------------------------------------------------------------

# Mirrors tools.schema.json's releaseVersion pattern: MAJOR.MINOR.PATCH
# with optional `-prerelease` and `+build` (SemVer 2.0.0).
SEMVER_RE = re.compile(
    r"^(?P<major>0|[1-9]\d*)"
    r"\.(?P<minor>0|[1-9]\d*)"
    r"\.(?P<patch>0|[1-9]\d*)"
    r"(?:-(?P<pre>[0-9A-Za-z.-]+))?"
    r"(?:\+(?P<build>[0-9A-Za-z.-]+))?$"
)


def parse_semver(value: str) -> tuple[int, int, int] | None:
    """Return (major, minor, patch) or None if `value` is not a SemVer core.

    Prerelease / build metadata are ignored for the gate's ordering —
    the gate only cares about the major.minor.patch gap. A pre-release
    `0.0.0-alpha` is treated as equal to `0.0.0`; a release that bumps
    to `0.0.0-beta` is the same release lineage as `0.0.0` for waiver-age
    purposes (the count of *distinct releaseVersion values* is what
    matters; see _waiver_release_distance).
    """
    if not isinstance(value, str):
        return None
    m = SEMVER_RE.match(value)
    if not m:
        return None
    return int(m.group("major")), int(m.group("minor")), int(m.group("patch"))


def _semver_key(v: str) -> tuple[int, int, int]:
    parsed = parse_semver(v)
    if parsed is None:
        # Unparseable versions sort to the very end so the gate flags them
        # as "waiver since-version unparseable" rather than silently passing.
        return (10**9, 10**9, 10**9)
    return parsed


# ---------------------------------------------------------------------------
# Waiver age
# ---------------------------------------------------------------------------

REQUIRED_WAIVER_FIELDS = ("reason", "since-release", "reviewer", "expires-after-releases")


def _waiver_release_distance(since_release: str, current_release: str, history: list[str]) -> int | None:
    """Return the number of distinct `tools.json` releases between
    `since-release` and the current `releaseVersion`, inclusive on both
    ends, or None if either version is unparseable.

    The "two releases" rule in FR-2 maps to: a waiver with
    `expires-after-releases: 2` covers exactly the release it was added
    in plus the next one. We implement that as: count the distinct
    versions from `since-release` (inclusive) up to `current_release`
    (inclusive) that actually appeared in the release history. If no
    history is provided, fall back to the SemVer distance between the
    two versions (1 if equal, else the +1 of the major/minor/patch gap).
    """
    if not history:
        # Fallback: count the number of distinct release "bumps" from
        # since-release (inclusive) up to current_release (inclusive).
        # The release that added the waiver counts as 1; every
        # subsequent SemVer major/minor/patch bump is a separate
        # release event. This implements FR-2's "two releases" rule:
        # a waiver with `expires-after-releases: 2` covers the release
        # it was added in (distance 1) plus the next one (distance 2);
        # the release after that (distance 3) triggers EXPIRED.
        since = _semver_key(since_release)
        cur = _semver_key(current_release)
        if since == (10**9, 10**9, 10**9) or cur == (10**9, 10**9, 10**9):
            return None
        if cur < since:
            return None
        major_bumps = cur[0] - since[0]
        minor_bumps = cur[1] - since[1] if major_bumps == 0 else 0
        patch_bumps = cur[2] - since[2] if major_bumps == 0 and minor_bumps == 0 else 0
        # The release that granted the waiver counts as the first
        # shipped event in its lifetime; add 1 to the raw bump count.
        return major_bumps + minor_bumps + patch_bumps + 1

    # History path: count distinct releaseVersion values that fall in
    # the inclusive range [since_release, current_release]. The history
    # is provided by the caller (typically from sw.js's release log;
    # reserved for a future story — Epic 5 owns the sw.js land).
    seen: set[str] = set()
    distance = 0
    for v in history:
        if v in seen:
            continue
        seen.add(v)
        if _semver_key(v) < _semver_key(since_release):
            continue
        if _semver_key(v) > _semver_key(current_release):
            break
        distance += 1
    return distance or None


# ---------------------------------------------------------------------------
# Gate logic (truth table from docs/quality-rubric.md#Scoring & Gate)
# ---------------------------------------------------------------------------

# Outcomes are strings so the report and the exit code can share one set.
OUTCOME_PASS = "PASS"
OUTCOME_WAIVER = "WAIVER"
OUTCOME_MISMATCH = "MISMATCH"
OUTCOME_FAIL = "FAIL"
OUTCOME_EXPIRED = "EXPIRED"

FAILING_OUTCOMES = {OUTCOME_MISMATCH, OUTCOME_FAIL, OUTCOME_EXPIRED}


def _evaluate_entry(entry: dict, current_release: str, history: list[str] | None) -> tuple[str, str]:
    """Apply the gate truth table to one entry.

    Returns (outcome, waiver_note) where waiver_note is empty for
    non-waiver rows and a human-readable note for waivered rows
    (e.g., "expires after 1 more release" or "expired at 0.1.0").
    """
    score = entry.get("score")
    ready = entry.get("ready")
    waiver = entry.get("score-waiver")

    # Validate waiver shape if present (gate is strict; schema allows
    # the same shape but this script runs before the validator in CI).
    if waiver is not None:
        if not isinstance(waiver, dict):
            return OUTCOME_FAIL, "score-waiver must be an object"
        missing = [k for k in REQUIRED_WAIVER_FIELDS if k not in waiver]
        if missing:
            return OUTCOME_FAIL, f"score-waiver missing required field(s): {missing}"
        exp = waiver.get("expires-after-releases")
        # Note: bool is a subclass of int in Python, so reject bool explicitly
        # (otherwise `True` would silently satisfy `< 1` and become `expires-after-releases = 1`).
        if isinstance(exp, bool) or not isinstance(exp, int) or exp < 1:
            return OUTCOME_FAIL, "score-waiver.expires-after-releases must be a positive integer"

    # Truth table (mirrors docs/quality-rubric.md exactly; rubric is source of truth):
    #   score >= 8 AND ready=true                                          -> PASS
    #   score >= 8 AND ready=false (no waiver)                             -> MISMATCH
    #   score <  8 AND waiver present and not expired AND ready=true       -> PASS
    #   score <  8 AND waiver present and not expired AND ready=false      -> WAIVER
    #   score <  8 AND ready=true without waiver                           -> MISMATCH
    #   score <  8 AND no waiver                                           -> FAIL
    #   score <  8 AND waiver expired                                      -> EXPIRED
    if isinstance(score, bool) or not isinstance(score, int):
        # Schema constrains score to integer 0–10, but the gate may be run
        # against a tools.json that bypassed the validator; surface the
        # type error rather than silently misclassify.
        return OUTCOME_FAIL, f"score must be an integer 0–10 (got {type(score).__name__}: {score!r})"
    if not 0 <= score <= 10:
        return OUTCOME_FAIL, f"score must be in 0–10 (got {score})"

    if score >= 8:
        if ready is True:
            return OUTCOME_PASS, ""
        return OUTCOME_MISMATCH, "score >= 8 but ready=false"

    # score < 8
    if waiver is None:
        if ready is True:
            return OUTCOME_MISMATCH, "ready=true but score < 8 and no waiver"
        return OUTCOME_FAIL, "score < 8 and no waiver"

    # score < 8 with a waiver
    since = waiver.get("since-release")
    expires_after = waiver.get("expires-after-releases")
    distance = _waiver_release_distance(since, current_release, history or [])
    if distance is None:
        return OUTCOME_FAIL, f"could not compute waiver age (since-release={since!r}, current={current_release!r})"
    if distance > expires_after:
        return OUTCOME_EXPIRED, (
            f"waiver since {since} has aged across {distance} releases "
            f"(expires-after-releases={expires_after})"
        )
    remaining = expires_after - distance
    # Rubric row 5: <8 + ready=true + valid waiver -> PASS (manual review completed).
    # Rubric row 4: <8 + ready=false + valid waiver -> WAIVER (sub-8 ship with justification).
    if ready is True:
        return OUTCOME_PASS, f"score < 8 but waiver valid and ready=true (since {since}; {remaining} more release(s))"
    return OUTCOME_WAIVER, f"waiver valid for {remaining} more release(s) (since {since})"


# ---------------------------------------------------------------------------
# Markdown escaping
# ---------------------------------------------------------------------------

def _md_cell(value: object) -> str:
    """Escape a Markdown table cell: pipes break the table, newlines break rows."""
    if value is None:
        return "—"
    s = str(value)
    s = s.replace("\\", "\\\\").replace("|", "\\|").replace("\r", " ").replace("\n", "<br>")
    return s


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def _render_report(rows: list[dict], summary: dict[str, int], release_version: str) -> None:
    print("# Tool Contract Gate")
    print("")
    print(f"- `tools.json` releaseVersion: **{release_version}**")
    print("")
    # Group by outcome: PASS, WAIVER, then failing
    group_order = [OUTCOME_PASS, OUTCOME_WAIVER, OUTCOME_MISMATCH, OUTCOME_FAIL, OUTCOME_EXPIRED]
    by_outcome: dict[str, list[dict]] = {o: [] for o in group_order}
    for row in rows:
        by_outcome.setdefault(row["outcome"], []).append(row)
    for outcome in group_order:
        group = by_outcome.get(outcome) or []
        if not group:
            continue
        heading = {
            OUTCOME_PASS: "Pass",
            OUTCOME_WAIVER: "Waivered (unexpired)",
            OUTCOME_MISMATCH: "Mismatch (ready / score inconsistency)",
            OUTCOME_FAIL: "Fail (no waiver)",
            OUTCOME_EXPIRED: "Waiver expired",
        }[outcome]
        print(f"## {heading} ({len(group)})")
        print("")
        print("| Slug | Score | Ready | Waiver | Outcome | Note |")
        print("|---|---|---|---|---|---|")
        for row in sorted(group, key=lambda r: r["slug"]):
            waiver_str = "yes" if row["has_waiver"] else "—"
            score_str = row["score"] if isinstance(row["score"], int) else "?"
            ready_str = row["ready"] if isinstance(row["ready"], bool) else "?"
            print(
                f"| {_md_cell(row['slug'])} | {score_str} | {ready_str} | {waiver_str} | "
                f"{row['outcome']} | {_md_cell(row['note'])} |"
            )
        print("")
    print(
        f"**Summary:** {summary['pass']} pass · {summary['waiver']} waivered · "
        f"{summary['failing']} failed."
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _print_contract() -> None:
    print("Tool Contract Gate — application-layer enforcement of AD-2.")
    print("")
    print("Source of truth: docs/quality-rubric.md#Scoring & Gate")
    print("")
    print("Truth table:")
    print("  score >= 8 AND ready=true                                          -> PASS    (exit 0)")
    print("  score >= 8 AND ready=false (no waiver)                             -> MISMATCH (exit 1)")
    print("  score <  8 AND waiver present and not expired                      -> WAIVER  (exit 0)")
    print("  score <  8 AND ready=true without waiver                           -> MISMATCH (exit 1)")
    print("  score <  8 AND no waiver                                           -> FAIL    (exit 1)")
    print("  score <  8 AND waiver expired                                      -> EXPIRED (exit 1)")
    print("")
    print("Exit codes: 0 = all pass (or all sub-8 waivered); 1 = at least one failure;")
    print("            2 = tools.json missing/unparseable; 3 = schema-invalid entry.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Tool Contract Gate — application-layer enforcement of AD-2.",
    )
    parser.add_argument("--list", action="store_true", help="Print the gate's contract and exit.")
    parser.add_argument("--root", default=None, help="Path to repo root (auto-detected if omitted).")
    args = parser.parse_args(argv)

    if args.list:
        _print_contract()
        return 0

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)
    tools_json_path = root / TOOLS_JSON_FILENAME
    data = load_json(tools_json_path)

    if not isinstance(data, dict):
        sys.stderr.write("tool-contract-gate: tools.json must be a JSON object at the top level.\n")
        return 3
    tools = data.get("tools")
    if not isinstance(tools, list):
        sys.stderr.write("tool-contract-gate: tools.json must have a `tools` array.\n")
        return 3

    current_release = data.get("releaseVersion", "0.0.0")
    if not isinstance(current_release, str) or not parse_semver(current_release):
        sys.stderr.write(
            f"tool-contract-gate: tools.json releaseVersion {current_release!r} is not valid SemVer.\n"
        )
        return 3

    # No release history is shipped yet (Epic 5's sw.js lands later); fall
    # back to the SemVer distance between since-release and current. When
    # a release history exists, it can be passed via --history (reserved
    # for a future story; AD-8 keeps the mirror check in `sw.js`).
    history: list[str] = []

    rows: list[dict] = []
    for entry in tools:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug", "?")
        outcome, note = _evaluate_entry(entry, current_release, history)
        rows.append(
            {
                "slug": slug,
                "score": entry.get("score"),
                "ready": entry.get("ready"),
                "has_waiver": entry.get("score-waiver") is not None,
                "outcome": outcome,
                "note": note,
            }
        )

    summary = {
        "pass": sum(1 for r in rows if r["outcome"] == OUTCOME_PASS),
        "waiver": sum(1 for r in rows if r["outcome"] == OUTCOME_WAIVER),
        "failing": sum(1 for r in rows if r["outcome"] in FAILING_OUTCOMES),
    }
    _render_report(rows, summary, current_release)

    if summary["failing"] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
