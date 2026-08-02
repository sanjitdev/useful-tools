#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-drift-check.py — Fail CI if any page's chrome has drifted from
assets/shell/chrome.html.

Pure-stdlib Python. Same shape as the four other scripts (no third-party
deps, exit codes 0/1/2/3).

Purpose
-------
The canonical Shell chrome lives in assets/shell/chrome.html, delimited by
`<!-- shell:header -->` / `<!-- /shell:header -->` and `<!-- shell:footer -->`
/ `<!-- /shell:footer -->` comments. Every page that renders the chrome
(index.html and each tools/<slug>/index.html) is expected to embed the
**same byte sequence** inside those regions. The script extracts the
canonical blocks from chrome.html and grep-matches them against every
target file.

If a drift is detected, the script exits 2 and prints one
`CHROME DRIFT: <path>` line per offending file. The intended CI use is
`make shell-drift` wired into the tool-contract-gate workflow so that
edits to chrome.html force a re-run of `scripts/shell-template.py` to
keep all pages in sync.

The check is **substring-based**, not parse-based. False positives
(e.g., a tool body that legitimately quotes the same anchor text inside
its form) can be silenced via `--allow-drift <path>`; this story
registers no exceptions.

Usage
-----
  python scripts/shell-drift-check.py            # check all pages
  python scripts/shell-drift-check.py --root ... # explicit repo root
  python scripts/shell-drift-check.py --allow-drift tools/<slug>/index.html

Exit codes
----------
  0 — no drift detected
  1 — (reserved) — currently unused; see exit 2 for drift
  2 — at least one page is out of sync (CHROME DRIFT reported), or chrome.html missing or missing markers
  3 — write error or unexpected I/O failure

Author: Handy Tools (Story 1.5 — Shell HTML Skeleton with Cobalt Tokens)
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

# ---------------------------------------------------------------------------
# Path handling — same walk-up pattern as the other scripts.
# ---------------------------------------------------------------------------

SCHEMA_ANCHOR = "tools.schema.json"
CHROME_REL = Path("assets/shell/chrome.html")


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"shell-drift-check: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"shell-drift-check: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Chrome extraction
# ---------------------------------------------------------------------------

HEADER_RE = re.compile(
    r"<!-- shell:header -->\s*(.*?)\s*<!-- /shell:header -->", re.DOTALL
)
FOOTER_RE = re.compile(
    r"<!-- shell:footer -->\s*(.*?)\s*<!-- /shell:footer -->", re.DOTALL
)


def load_chrome(root: Path) -> tuple[str, str]:
    path = root / CHROME_REL
    if not path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {path}\n")
        sys.exit(2)
    text = path.read_text(encoding="utf-8")
    header_match = HEADER_RE.search(text)
    footer_match = FOOTER_RE.search(text)
    if not header_match or not footer_match:
        sys.stderr.write(
            "shell-drift-check: chrome.html missing one of "
            "{shell:header, shell:footer} markers\n"
        )
        sys.exit(2)
    return header_match.group(1), footer_match.group(1)


# ---------------------------------------------------------------------------
# Drift scan
# ---------------------------------------------------------------------------

INDEX_REL = Path("index.html")
TOOLS_DIR_REL = Path("tools")


def iter_target_files(root: Path) -> list[Path]:
    paths: list[Path] = [root / INDEX_REL]
    tools_dir = root / TOOLS_DIR_REL
    if tools_dir.is_dir():
        for child in sorted(tools_dir.iterdir()):
            if not child.is_dir():
                continue
            page = child / "index.html"
            if page.is_file():
                paths.append(page)
    return paths


def normalize(text: str) -> str:
    """Replace per-context hrefs with a placeholder so home and tool pages
    can be compared against the same canonical chrome. The brand link is
    the only intentional difference: home uses `#top`, tool pages use
    `../../index.html`."""
    return re.sub(
        r'href="#top"',
        'href="__BRAND_HREF__"',
        text,
    ).replace(
        'href="../../index.html"',
        'href="__BRAND_HREF__"',
        1,
    )


def scan(root: Path, header: str, footer: str, allowed: set[Path]) -> int:
    header_norm = normalize(header)
    footer_norm = normalize(footer)
    # Allow lookup by both absolute path and relative POSIX string so
    # CLI users can pass either form to --allow-drift and have it work.
    allowed_abs = {a.resolve() for a in allowed}
    allowed_rel = {a.as_posix() for a in (a.relative_to(root) for a in allowed_abs if a.is_absolute())}
    failures = 0
    for path in iter_target_files(root):
        rel = path.relative_to(root)
        if path.resolve() in allowed_abs or rel.as_posix() in allowed_rel:
            print(f"  skip-drift {rel}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-drift-check: cannot read {path}: {exc}\n")
            failures += 1
            continue
        text_norm = normalize(text)
        ok = header_norm in text_norm and footer_norm in text_norm
        if ok:
            print(f"  ok      {rel}")
        else:
            sys.stderr.write(f"CHROME DRIFT: {rel}\n")
            failures += 1
    return failures


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--allow-drift",
        action="append",
        default=[],
        metavar="PATH",
        help="path to exclude from the drift scan (repeatable)",
    )
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)
    header, footer = load_chrome(root)
    allowed = {(root / p).resolve() for p in args.allow_drift}

    print(f"shell-drift-check: scanning {len(iter_target_files(root))} page(s)")
    failures = scan(root, header, footer, allowed)
    if failures:
        print(f"shell-drift-check: {failures} drift(s) detected")
        return 2
    print("shell-drift-check: all pages in sync")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))