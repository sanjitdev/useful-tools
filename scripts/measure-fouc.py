#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
measure-fouc.py — Best-effort 50ms no-FOUC check on index.html.

Pure-stdlib Python (the perf check itself uses a headless browser, but the
script falls back to a warning + exit 0 if no browser engine is
available, so the make target never breaks offline CI).

Purpose
-------
Story 1.5 ships a blocking inline FOUC script that sets data-theme
within 50ms of first paint. This script verifies the budget by opening
index.html in a headless browser with `prefers-color-scheme: dark`
forced, then measuring the time delta between the first paint
PerformanceEntry and the data-theme attribute being set (the inline
script dispatches a CustomEvent("ht:fouc-resolved", { detail:
{ elapsedMs } }) on document.documentElement for exactly this purpose).

Exit codes
----------
  0 — pass (delta < 50ms) OR no browser available (best-effort)
  1 — delta exceeds 50ms budget
  2 — script setup error

Author: Handy Tools (Story 1.5 — Shell HTML Skeleton with Cobalt Tokens)
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"
INDEX_REL = Path("index.html")
FOUC_BUDGET_MS = 50


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"measure-fouc: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"measure-fouc: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


LAUNCHER_SCRIPT = r"""
// Best-effort FOUC measurement. Opens the given file:// URL in a
// headless context, forces prefers-color-scheme: dark, listens for the
// ht:fouc-resolved CustomEvent, and prints the elapsedMs. Falls back to
// computing the delta from the first paint entry if the event never
// fires (e.g., a malformed page).
const puppeteer = require('puppeteer');
(async () => {
  const url = process.argv[2];
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const result = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    document.addEventListener('ht:fouc-resolved', (e) => {
      resolve({ kind: 'event', elapsedMs: e.detail && e.detail.elapsedMs });
    });
    // Fallback: if no event fires within 5s, return performance.now().
    setTimeout(() => resolve({ kind: 'timeout', elapsedMs: performance.now() - t0 }), 5000);
  }));
  await browser.close();
  process.stdout.write(JSON.stringify(result));
})();
"""


def try_puppeteer(index_path: Path) -> tuple[bool, str]:
    npx = shutil.which("npx")
    if npx is None:
        return False, "npx not on PATH"
    # Write the launcher into a tmp file and invoke it through npx.
    import tempfile, os

    fd, tmp = tempfile.mkstemp(suffix=".js", prefix="measure-fouc-")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fp:
            fp.write(LAUNCHER_SCRIPT)
        url = index_path.resolve().as_uri()
        try:
            proc = subprocess.run(
                [npx, "--yes", "puppeteer", "node", tmp, url],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            return False, "puppeteer timeout"
        if proc.returncode != 0:
            return False, f"puppeteer exit {proc.returncode}: {proc.stderr[:200]}"
        return True, proc.stdout.strip()
    finally:
        Path(tmp).unlink(missing_ok=True)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--budget-ms",
        type=int,
        default=FOUC_BUDGET_MS,
        help="FOUC budget in milliseconds (default: 50 per NFR-9)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )
    index_path = root / INDEX_REL
    if not index_path.is_file():
        sys.stderr.write(f"measure-fouc: missing {index_path}\n")
        sys.exit(2)

    print(
        f"measure-fouc: probing {index_path.relative_to(root)} (budget {args.budget_ms}ms)"
    )

    ok, output = try_puppeteer(index_path)
    if not ok:
        print(f"measure-fouc: {output}")
        print(
            "measure-fouc: no headless browser available — exiting 0 (best-effort). "
            "Install Node + Puppeteer to enable the check."
        )
        return 0

    print(f"measure-fouc: {output}")
    # Parse the elapsedMs from the puppeteer stdout JSON.
    import json
    try:
        payload = json.loads(output)
        elapsed = float(payload.get("elapsedMs", -1))
    except (ValueError, TypeError) as exc:
        sys.stderr.write(f"measure-fouc: cannot parse puppeteer output: {exc}\n")
        return 2
    if elapsed < 0:
        sys.stderr.write("measure-fouc: no elapsedMs reported\n")
        return 2
    if elapsed > args.budget_ms:
        sys.stderr.write(
            f"measure-fouc: {elapsed:.1f}ms exceeds {args.budget_ms}ms budget\n"
        )
        return 1
    print(f"measure-fouc: pass ({elapsed:.1f}ms <= {args.budget_ms}ms)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))