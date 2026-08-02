#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-a11y-check.py — Verify AC #1's structural invariants that the
byte-level drift check (shell-drift-check.py) cannot catch.

Pure-stdlib Python. Same exit-code contract as the four prior scripts:
0 = pass, 1 = violation found, 2 = setup error. Markdown status to stdout.

Purpose
-------
The drift check is substring-based against chrome.html's header/footer
regions. It cannot tell whether:
  - Every page actually carries a <main id="main" class="shell-main"
    aria-label="..." tabindex="-1"> with a non-empty aria-label.
  - assets/css/base.css declares cobalt tokens at :root and the dark
    theme override at :root[data-theme="dark"].

Both are load-bearing for AC #1 ("<main> carries a landmark aria-label
reflecting the current tool or page" + "CSS variables (cobalt palette)
are applied at :root"). This script fills the verification gap with two
mechanical regex assertions:

  1. Every index.html and tools/<slug>/index.html contains exactly one
     <main id="main" class="shell-main" aria-label="..." tabindex="-1">
     whose aria-label value is non-empty and non-whitespace.
  2. assets/css/base.css contains :root { --color-primary: #2F5BFF; ... }
     and :root[data-theme="dark"] { ... } blocks.

Exit codes
----------
  0 — pass
  1 — at least one a11y violation
  2 — setup error (missing files, malformed CSS)

Author: Handy Tools (Story 1.5 — code review follow-up, Decision #1)
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"

# The exact `<main>` opener shape chrome.html / shell-template.py write.
# The aria-label capture is non-greedy and forbids another quote inside.
MAIN_RE = re.compile(
    r'<main\s+id="main"\s+class="shell-main"\s+aria-label="([^"]+)"\s+tabindex="-1">',
    re.IGNORECASE,
)

# Cobalt token literals per DESIGN.md §"Colors → Brand/primary".
COBALT_TOKEN_NAMES = (
    "--color-primary",
    "--color-primary-hover",
    "--color-primary-pressed",
    "--color-on-primary",
    "--color-primary-soft",
    "--color-primary-soft-strong",
)


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"shell-a11y-check: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"shell-a11y-check: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def iter_target_files(root: Path) -> list[Path]:
    paths: list[Path] = []
    home = root / "index.html"
    if home.is_file():
        paths.append(home)
    tools_dir = root / "tools"
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            page = slug_dir / "index.html"
            if page.is_file():
                paths.append(page)
    return paths


def check_main_landmark(path: Path) -> list[str]:
    """Return a list of human-readable violations for the given page."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    matches = MAIN_RE.findall(text)
    if len(matches) == 0:
        return ["no <main id=\"main\" class=\"shell-main\" aria-label=\"...\" tabindex=\"-1\"> landmark"]
    if len(matches) > 1:
        return [f"found {len(matches)} <main> landmarks; expected exactly 1"]
    label = matches[0].strip()
    if not label:
        return ["<main aria-label=\"\"> is empty or whitespace-only"]
    return []


def check_base_css(path: Path) -> list[str]:
    """Verify cobalt tokens are declared at :root and the dark override
    exists at :root[data-theme=\"dark\"]."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read base.css: {exc}"]

    violations: list[str] = []

    # 1. Cobalt tokens declared at :root.
    # Extract the first plain `:root { ... }` block.
    root_block_m = re.search(r":root\s*\{([^{}]*)\}", text, re.DOTALL)
    if not root_block_m:
        violations.append("no plain :root { ... } block found")
    else:
        root_block = root_block_m.group(1)
        for name in COBALT_TOKEN_NAMES:
            if name not in root_block:
                violations.append(f"cobalt token {name} missing from :root block")

    # 2. Dark override at :root[data-theme="dark"].
    dark_block_m = re.search(
        r":root\[data-theme=\"dark\"\]\s*\{[^{}]*\}",
        text,
        re.DOTALL,
    )
    if not dark_block_m:
        violations.append('no :root[data-theme="dark"] { ... } override block found')

    return violations


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    failures = 0
    targets = iter_target_files(root)
    if not targets:
        sys.stderr.write(f"shell-a11y-check: no target pages found under {root}\n")
        return 2

    print(f"shell-a11y-check: scanning {len(targets)} page(s) for <main aria-label>")
    for path in targets:
        violations = check_main_landmark(path)
        rel = path.relative_to(root)
        if violations:
            failures += 1
            for v in violations:
                print(f"  FAIL    {rel}  {v}")
        else:
            print(f"  ok      {rel}")

    base_css = root / "assets" / "css" / "base.css"
    if not base_css.is_file():
        sys.stderr.write(f"shell-a11y-check: missing {base_css}\n")
        return 2
    print(f"shell-a11y-check: verifying cobalt tokens in {base_css.relative_to(root)}")
    css_violations = check_base_css(base_css)
    if css_violations:
        failures += 1
        for v in css_violations:
            print(f"  FAIL    {base_css.relative_to(root)}  {v}")
    else:
        print(f"  ok      {base_css.relative_to(root)}")

    if failures:
        print(f"shell-a11y-check: {failures} violation(s) found")
        return 1
    print("shell-a11y-check: all structural a11y invariants pass")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))