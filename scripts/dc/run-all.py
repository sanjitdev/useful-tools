#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
run-all.py — runner that executes every dc-* gate in order.

Mirrors the runner pattern used elsewhere in the repo (e.g. the
regression-sweep wrapper around bundle-size-gate.py): invoke each
script as a subprocess, parse the last-line `JSON:{...}` payload, and
print a table of results. Exit 0 only if every story passes.

Adds an assertion that the runner knows about every story (catches
the "future contributor added a story and forgot to update the
runner" failure mode from the plan's Risk table).

Usage: `make dc-all` or `python scripts/dc/run-all.py`.
"""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent

STORIES = [
    ("DC-0",  "dc-0-schema.py"),
    ("DC-1",  "dc-1-scoring.py"),
    ("DC-2",  "dc-2-results.py"),
    ("DC-3",  "dc-3-challenge.py"),
    ("DC-4",  "dc-4-recommend.py"),
    ("DC-5",  "dc-5-loader.py"),
    ("DC-6",  "dc-6-quizzes.py"),
    ("DC-7",  "dc-7-tools-json.py"),
    ("DC-8",  "dc-8-docs.py"),
    ("DC-9",  "dc-9-smokes.py"),
    ("DC-10", "dc-10-pack-gate.py"),
    ("DC-11", "dc-11-bundle.py"),
    ("DC-12", "dc-12-retro.py"),
    ("DC-13", "dc-13-challenge-ux.py"),
    ("DC-14", "dc-14-result-card-actions.py"),
    ("DC-15", "dc-15-browser-render.py"),
    ("DC-16", "dc-16-share-card.py"),
]
EXPECTED_STORY_COUNT = 17


def parse_last_json(out):
    """Pull the last-line JSON:{...} payload from a dc-* script's stdout."""
    if not out:
        return {}
    for line in out.splitlines()[::-1]:
        if line.startswith("JSON:"):
            try:
                return json.loads(line[5:])
            except Exception:
                return {}
    return {}


def run_one(label, script):
    t0 = time.time()
    r = subprocess.run(
        [sys.executable, str(HERE / script)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    dt = time.time() - t0
    summary = parse_last_json(r.stdout)
    return (
        label,
        script,
        r.returncode,
        summary.get("pass", 0),
        summary.get("fail", 0),
        dt,
        r.stdout,
        r.stderr,
    )


def main():
    # Guard against forgotten updates
    actual = len(STORIES)
    if actual != EXPECTED_STORY_COUNT:
        print(
            f"runner FAIL: expected {EXPECTED_STORY_COUNT} stories, "
            f"found {actual}. Update STORIES + EXPECTED_STORY_COUNT in "
            f"run-all.py when adding a new story."
        )
        sys.exit(1)

    print(f"Discovery Epic — running {len(STORIES)} AC gates")
    print("=" * 72)

    results = []
    overall_rc = 0
    for label, script in STORIES:
        row = run_one(label, script)
        results.append(row)
        if row[2] != 0:
            overall_rc = 1

    # Print summary table
    print("\n" + "=" * 72)
    print(
        f"{'Story':<8} {'Script':<24} {'Pass':>6} {'Fail':>6} "
        f"{'Time':>8} {'Status':>8}"
    )
    print("-" * 72)
    for label, script, rc, p, f, dt, _, _ in results:
        status = "PASS" if rc == 0 else "FAIL"
        print(
            f"{label:<8} {script:<24} {p:>6} {f:>6} "
            f"{dt:>7.2f}s {status:>8}"
        )
    print("=" * 72)

    # Per-story detail (only the FAIL ones — PASS rows are usually empty)
    print()
    for label, script, rc, p, f, dt, out, err in results:
        if rc != 0:
            print(f"--- {label} ({script}) FAIL ---")
            # Print the tail of stdout so the FAIL labels are visible
            tail = "\n".join((out or "").splitlines()[-30:])
            print(tail)
            if err:
                print("--- stderr ---")
                print(err.strip())
            print()

    if overall_rc == 0:
        print("ALL GREEN — Discovery Epic AC gates pass.")
    else:
        failed = [s for s, _, rc, *_ in results if rc != 0]
        print(f"{len(failed)}/{len(results)} stories RED: {failed}")

    sys.exit(overall_rc)


if __name__ == "__main__":
    main()