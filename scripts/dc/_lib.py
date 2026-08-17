#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_lib.py — shared harness for the Discovery Epic AC gates (dc-*).

Each `scripts/dc/dc-<n>.py` imports `check()` / `exit_with_summary()` /
`section()` from this module. Mirrors the shape used by every other
gate in the repo: print PASS/FAIL lines, emit a final
`JSON:{...}` payload, exit 0 on all-pass / 1 on any-fail, and
fail-closed (exit 1) if no assertions ran (vacuous-pass guard —
same posture as `_smoke_quiz_proxy.js`).

Pure stdlib. No third-party deps. Safe to import from any dc-* script.
"""
from __future__ import annotations

import json
import sys

pass_count = 0
fail_count = 0


def check(cond, label):
    """Record one assertion. `cond` is truthy/falsy. `label` is the
    human-readable AC line that gets echoed to stdout.
    """
    global pass_count, fail_count
    if cond:
        pass_count += 1
        print("  PASS  " + label)
    else:
        fail_count += 1
        print("  FAIL  " + label)


def section(name):
    """Print a section header so the run-log is self-documenting."""
    print("\n[" + name + "]")


def emit_summary(story_id, extras=None):
    """Print the last-line JSON payload for CI scraping.

    Mirrors bundle-size-gate.py line 570: the final stdout line is
    `JSON:{...}` and the runner parses it back out.
    """
    summary = {"story": story_id, "pass": pass_count, "fail": fail_count}
    if extras:
        summary.update(extras)
    print("\nJSON:" + json.dumps(summary))


def exit_with_summary(story_id, extras=None):
    """Emit the summary, apply the vacuous-pass guard, and exit 0/1.

    Vacuous-pass guard: if no assertions ran at all (pass + fail == 0),
    fail the gate — same posture as the Node smokes. Catches the
    "script imported the lib but the AC list is empty" failure mode.
    """
    emit_summary(story_id, extras)
    if pass_count == 0 and fail_count == 0:
        print("  FAIL  (no assertions ran — vacuous pass guard)")
        sys.exit(1)
    sys.exit(0 if fail_count == 0 else 1)


def repo_root():
    """Return the repo root (two parents up from scripts/dc/_lib.py)."""
    from pathlib import Path
    return Path(__file__).resolve().parent.parent.parent


def read_text(rel_path):
    """Read a repo-relative file as UTF-8 text. Returns None on error."""
    from pathlib import Path
    p = repo_root() / rel_path
    try:
        return p.read_text(encoding="utf-8")
    except (FileNotFoundError, UnicodeDecodeError, OSError):
        return None


def file_exists(rel_path):
    """True if the repo-relative file exists on disk."""
    from pathlib import Path
    return (repo_root() / rel_path).is_file()


def gzipped_size(rel_path):
    """Return the gzipped byte size of a file, or None on error.

    Mirrors the measurement in bundle-size-gate.py: gzip the file
    with default level, count the bytes. Used by the per-module size
    caps (DC-1..DC-5).
    """
    import gzip
    from pathlib import Path
    p = repo_root() / rel_path
    try:
        data = p.read_bytes()
    except OSError:
        return None
    return len(gzip.compress(data))


def run_node(script_text, timeout=10):
    """Run a Node snippet via stdin and return (returncode, stdout, stderr).

    Used by dc-* scripts that need to exercise a real .js file in a
    vm sandbox (DC-1..DC-5, DC-9). The snippet is piped to `node` on
    stdin — no temp file is written, so the call is side-effect-free
    on the working tree.

    Uses UTF-8 explicitly for stdin/stdout/stderr so non-ASCII chars
    in fixtures (emoji, accents) survive Windows' default cp1252.
    """
    import subprocess
    try:
        r = subprocess.run(
            ["node", "-"],
            input=script_text,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        return r.returncode, r.stdout, r.stderr
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return 127, "", "node not found or timed out"