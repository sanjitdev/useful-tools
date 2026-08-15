#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_regression_sweep.py — Thin Python wrapper around the Node regression sweep.

The Node harness (scripts/_smoke_regression_sweep.js) is the source of truth
for cross-cutting tool JS evaluation. This wrapper exists for three reasons:

  1. Python is the project's canonical CI glue (see scripts/tool-contract-gate.py,
     scripts/site-config-gate.py, scripts/shell-bounds-check.py). It keeps the
     Makefile and CI workflow consistent — every gate is `python3 scripts/X.py`.
  2. The Python wrapper parses the JSON last-line output, so CI/log scrapers
     can extract per-row results without re-running the Node harness.
  3. The wrapper writes a stable `.regression-sweep-output.txt` artifact at
     the repo root so CI can upload it as a build artifact.

Usage
-----
  python scripts/_regression_sweep.py            # run the sweep
  python scripts/_regression_sweep.py --root ... # explicit repo root
  python scripts/_regression_sweep.py --out ...  # override output file

Exit codes (mirrors the Node harness)
--------------------------------------
  0 — all checks pass (all tools + all checks)
  1 — at least one tool failed at least one check
  2 — vacuous pass (no ready:true tools, or Node output missing the JSON line)
  3 — invocation error (Node not on PATH, output file unwritable, etc.)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Force UTF-8 on stdout/stderr so the Markdown report renders correctly on
# Windows consoles (cp1252) without crashing on ✓ / ✗ / non-ASCII quotes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

DEFAULT_HARNESS = Path("scripts/_smoke_regression_sweep.js")
DEFAULT_OUTPUT = Path(".regression-sweep-output.txt")
JSON_LINE_RE = re.compile(r"^JSON:(?P<body>\{.*\})\s*$")


# ---------------------------------------------------------------------------
# Path handling (same walk-up pattern as the other CI gates)
# ---------------------------------------------------------------------------

def resolve_repo_root(arg: str | None) -> Path:
    """Return the repo root, walking up until we find tools.json."""
    if arg:
        root = Path(arg).resolve()
        if not (root / "tools.json").exists():
            sys.stderr.write(f"FAIL  --root does not contain tools.json: {root}\n")
            sys.exit(3)
        return root
    here = Path.cwd()
    for cand in (here, *here.parents):
        if (cand / "tools.json").exists():
            return cand
    sys.stderr.write(f"FAIL  could not locate tools.json from {here}\n")
    sys.exit(3)


# ---------------------------------------------------------------------------
# Node harness invocation
# ---------------------------------------------------------------------------

def run_node_harness(repo_root: Path, harness: Path) -> tuple[int, str, str]:
    """Execute the Node sweep, forwarding whatever it printed to stdout/stderr."""
    node = shutil.which("node")
    if not node:
        sys.stderr.write("FAIL  node not found on PATH\n")
        sys.exit(3)
    harness_abs = (repo_root / harness).resolve()
    if not harness_abs.exists():
        sys.stderr.write(f"FAIL  harness not found: {harness_abs}\n")
        sys.exit(3)
    proc = subprocess.run(
        [node, str(harness_abs)],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return proc.returncode, proc.stdout, proc.stderr


# ---------------------------------------------------------------------------
# Output parsing
# ---------------------------------------------------------------------------

def parse_last_json(stdout: str) -> dict | None:
    """Extract the JSON summary the Node harness prints as its last line."""
    last = None
    for line in stdout.splitlines():
        if line.startswith("JSON:"):
            last = line[len("JSON:"):]
    if not last:
        return None
    try:
        return json.loads(last)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"FAIL  could not parse JSON line: {e}\n")
        return None


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def render_table(summary: dict) -> str:
    """Render the per-tool rows as a Markdown table."""
    rows = summary.get("rows", [])
    header = [
        "| slug | 1·schema | 2·html | 3·jsLoad | 4·history | 5·console.error | 6·fetch | 7·scriptLoadOrder | errors |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    body = []
    keys = ("schema", "html", "jsLoad", "history", "consoleError", "fetch", "scriptLoadOrder")
    for r in rows:
        cells = [r["slug"]]
        for k in keys:
            v = r["results"][k]
            if v is True:
                cells.append("✓")
            elif v == "skip":
                cells.append("·")
            else:
                cells.append("✗")
        errors = r["errors"]
        if errors:
            err_cell = "<br>".join(errors)
        else:
            err_cell = "—"
        cells.append(err_cell)
        body.append("| " + " | ".join(cells) + " |")
    return "\n".join(header + body)


def render_report(summary: dict, node_exit: int) -> str:
    """Top-level Markdown report — readable in CI logs and on the GitHub Actions UI."""
    tools_total = summary["tools_total"]
    tools_pass = summary["tools_pass"]
    checks_total = summary["checks_total"]
    checks_pass = summary["checks_pass"]
    checks_skip = summary["checks_skip"]
    checks_fail = summary["checks_fail"]
    pct = (checks_pass / checks_total * 100.0) if checks_total else 0.0
    status = "PASS" if checks_fail == 0 else "FAIL"
    lines = [
        f"# Regression sweep — {status}",
        "",
        f"**Tools:** {tools_pass}/{tools_total} pass",
        f"**Checks:** {checks_pass}/{checks_total} pass "
        f"({checks_skip} skip, {checks_fail} fail, {pct:.1f}%)",
        f"**Node exit code:** {node_exit}",
        "",
        render_table(summary),
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the cross-cutting regression sweep.",
    )
    parser.add_argument("--root", help="Repo root (default: walk up to tools.json)")
    parser.add_argument("--harness", default=str(DEFAULT_HARNESS),
                        help=f"Node harness path (default: {DEFAULT_HARNESS})")
    parser.add_argument("--out", default=str(DEFAULT_OUTPUT),
                        help=f"Output report path (default: {DEFAULT_OUTPUT})")
    args = parser.parse_args()

    repo_root = resolve_repo_root(args.root)
    harness = Path(args.harness)
    output_path = repo_root / args.out

    # Make sure the output file is writable. CI usually runs as a user with
    # write access to the workspace root, but local dev on a read-only mount
    # would otherwise produce a confusing late-stage failure.
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        sys.stderr.write(f"FAIL  cannot create output dir: {e}\n")
        return 3

    node_exit, stdout, stderr = run_node_harness(repo_root, harness)
    # Forward the Node harness's own stdout/stderr so the live progress table
    # shows up in CI logs. The JSON summary is at the end of stdout.
    sys.stdout.write(stdout)
    if stderr:
        sys.stderr.write(stderr)

    summary = parse_last_json(stdout)
    if summary is None:
        sys.stderr.write("FAIL  Node harness did not emit a JSON summary line\n")
        # Still write what we have so post-mortem debugging has context.
        output_path.write_text(
            "# Regression sweep — VACUOUS\n\n"
            f"Node exit code: {node_exit}\n\n"
            "Node harness did not emit a JSON summary line.\n"
            f"--- stdout ---\n{stdout}\n\n--- stderr ---\n{stderr}\n",
            encoding="utf-8",
        )
        return 2

    report = render_report(summary, node_exit)
    output_path.write_text(report, encoding="utf-8")

    # Mirror the Node harness's exit codes. The harness already prints PASS
    # when everything is green; the wrapper duplicates the failure decision
    # via the JSON summary so CI sees the same code either way.
    if summary["checks_fail"] > 0:
        return 1
    if summary["tools_total"] == 0 or summary["checks_total"] == 0:
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
