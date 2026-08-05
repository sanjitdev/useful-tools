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
    aria-label="..." tabindex="-1"> with a non-empty aria-label that
    matches the page's expected label (home → "Handy Tools home";
    tool pages → the tool's display name derived from <title>).
  - Every page's <head> contains the blocking inline FOUC IIFE
    (the 50ms no-FOUC budget lives in that script; a single page
    missing it ships a flash-of-light-theme undetected).
  - assets/css/base.css declares cobalt tokens at :root and the dark
    theme override at :root[data-theme="dark"].

All four invariants are load-bearing for AC #1 (FR-9 + NFR-9 + UX-DR-1
+ UX-DR-19). This script fills the verification gap with four
mechanical regex assertions:

  1. Every index.html and tools/<slug>/index.html contains exactly one
     <main id="main" class="shell-main" aria-label="..." tabindex="-1">
     whose aria-label value is non-empty and non-whitespace.
  2. The same aria-label value matches the page's expected label:
     "Handy Tools home" for the home page, the tool's display name
     (derived from <title>) for tool pages.
  3. The blocking inline FOUC IIFE byte sequence from
     assets/shell/head-snippet.html appears verbatim in every page.
  4. assets/css/base.css contains :root { --color-primary: #2F5BFF; ... }
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
import html
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

# `<title>` opener: capture the text content (greedy until </title>).
TITLE_RE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE | re.DOTALL)

# Extract the inline `<script>...</script>` IIFE from head-snippet.html.
# The IIFE is minified to a single line; the capture is non-greedy on
# the closing tag so the next-comment block doesn't get pulled in.
FOUC_SCRIPT_RE = re.compile(
    r"<script>([^<]+)</script>",
    re.IGNORECASE,
)

# Mirror of shell-template.py's derive_display_name so the per-page
# aria-label contract has a single source of truth on disk.
DISPLAY_NAME_RE = re.compile(r"\s+·\s+Handy Tools\s*$")

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


def derive_display_name(title_text: str) -> str:
    """`<title>Age Calculator · Handy Tools</title>` → `Age Calculator`.

    Mirror of the same function in shell-template.py (kept as a copy —
    the two scripts already share the canonical byte-extraction pattern,
    and a single-source import across scripts would couple them for
    little gain). Whitespace-only or empty titles fall back to a generic
    label so the <main aria-label> on the rendered page is never empty.
    HTML-entities are decoded so `Pros &amp; Cons` → `Pros & Cons` for
    screen readers (do not read the literal entity string).
    """
    cleaned = DISPLAY_NAME_RE.sub("", title_text).strip()
    if not cleaned:
        return "Handy Tools"
    return html.unescape(cleaned)


def expected_aria_label(path: Path, root: Path) -> tuple[str, str]:
    """Return (expected_label, source_description) for the page's <main>.

    The home page carries the literal "Handy Tools home". Tool pages
    derive the label from the page's <title> via the same helper
    shell-template.py uses during regeneration, so this check is the
    single source of truth on disk for the per-page label contract.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return ("", f"<title> unreadable: {exc}")
    if path == root / "index.html":
        return ("Handy Tools home", "<literal home page label>")
    title_match = TITLE_RE.search(text)
    if not title_match:
        return ("", "no <title> in page")
    return (
        derive_display_name(title_match.group(1)),
        "<title> after derive_display_name",
    )


def check_main_aria_label(path: Path, root: Path) -> list[str]:
    """Verify the per-page <main aria-label> matches the expected value.

    The drift check + a11y check both rejected the empty-label case, but
    neither pinned the *content* of the label. Without this check, a
    regression that writes `aria-label="Handy Tools"` on every page
    passes both gates — landing screen-reader users on the wrong
    landmark. This is the AC #1 contract: "reflecting the current tool
    or page".
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    matches = MAIN_RE.findall(text)
    if len(matches) != 1:
        # Already reported by check_main_landmark — skip.
        return []
    actual = matches[0].strip()
    expected, source = expected_aria_label(path, root)
    if not expected:
        return [f"cannot derive expected aria-label ({source})"]
    if actual != expected:
        return [
            f"<main aria-label=\"{actual}\"> does not match expected "
            f'"{expected}" (derived from {source})'
        ]
    return []


def load_canonical_fouc_iife(root: Path) -> str:
    """Extract the inline IIFE byte sequence from
    assets/shell/head-snippet.html.

    Returns "" on missing/unreadable file or absent <script> block; the
    caller turns that into a violation per page so the failure is loud.
    """
    snippet = root / "assets" / "shell" / "head-snippet.html"
    if not snippet.is_file():
        return ""
    try:
        text = snippet.read_text(encoding="utf-8")
    except OSError:
        return ""
    matches = FOUC_SCRIPT_RE.findall(text)
    if not matches:
        return ""
    # The first <script> block in head-snippet.html is the IIFE.
    return matches[0].strip()


def check_fouc_script(path: Path, canonical_iife: str) -> list[str]:
    """Verify the blocking inline FOUC IIFE is present in this page's <head>.

    The 50ms no-FOUC budget lives in the IIFE; if a future PR deletes
    the inline <script> tag on a single page, the drift check (header/
    footer only) and the cobalt-token check (base.css) both pass, and
    AC #1's "data-theme within 50ms of first paint" is silently broken
    on that page. The IIFE is byte-equivalent across every page
    (defined in assets/shell/head-snippet.html), so substring-match is
    the right shape of check.
    """
    if not canonical_iife:
        return ["no canonical FOUC IIFE available (head-snippet.html empty or unreadable)"]
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    if canonical_iife not in text:
        return [
            "blocking inline FOUC IIFE missing from <head> "
            "(50ms no-FOUC budget dependency)"
        ]
    return []


def emit(violations: list[str], rel: Path, kind: str) -> int:
    """Print pass/fail lines for one page check; return 1 if any violation."""
    if violations:
        for v in violations:
            print(f"  FAIL    {rel}  {v}")
        return 1
    print(f"  ok      {rel}  {kind}")
    return 0


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

    canonical_iife = load_canonical_fouc_iife(root)

    print(f"shell-a11y-check: scanning {len(targets)} page(s) for <main aria-label>")
    for path in targets:
        rel = path.relative_to(root)
        failures += emit(check_main_landmark(path), rel, "<main> landmark shape")
        failures += emit(check_main_aria_label(path, root), rel, "<main aria-label> content")
        failures += emit(check_fouc_script(path, canonical_iife), rel, "inline FOUC IIFE")

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