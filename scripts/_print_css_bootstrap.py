"""
_print_css_bootstrap.py — Story 2.7 / Story 2.8 bulk-add @media print blocks.

Pure-stdlib Python. For each Wave-2 + Wave-3 tool, appends a standard
@media print block to tools/<slug>/<slug>.css (idempotent — checks for
existing block first).

The print block hides the Shell chrome (header, footer, dialogs) and
forces black-on-white text per the rubric #5 (Printable) contract.

Usage:
    python scripts/_print_css_bootstrap.py            # all 15+17 = 32 tools
    python scripts/_print_css_bootstrap.py --slug <s> # single tool
    python scripts/_print_css_bootstrap.py --quiet    # suppress progress

Exit codes:
    0 — all targets processed (added or already present)
    2 — repo layout issue
    3 — I/O failure
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"

# Wave-2 tool list (Story 2.7 — matches _promote_wave_2.py's roster).
WAVE_2_SLUGS = (
    "bd-tax-calculator",
    "animal-race",
    "space-calculator",
    "age-calculator",
    "random-tools",
    "world-clock",
    "grade-calculator",
    "decision-wheel",
    "gpa-calculator",
    "loan-calculator",
    "countdown-to-date",
    "markdown-previewer",
    "calorie-estimator",
    "stopwatch",
    "compound-interest",
)

# Wave-3 tool list (Story 2.8 — matches _promote_wave_3.py's roster).
WAVE_3_SLUGS = (
    "json-formatter",
    "color-tools",
    "date-difference",
    "lorem-ipsum",
    "pros-cons",
    "unit-converter",
    "password-strength",
    "pomodoro-timer",
    "habit-tracker",
    "regex-tester",
    "eisenhower-matrix",
    "bmi-calculator",
    "word-counter",
    "percentage-calculator",
    "base64-codec",
    "tip-calculator",
    "url-codec",
)

# Standard print block. Mirrors the rubric #5 contract:
# "Hides chrome and forces black-on-white text."
PRINT_BLOCK = """\n/* ============================================
   Story 2.7 / Story 2.8 — @media print block (rubric #5 Printable).
   Idempotent — added by scripts/_print_css_bootstrap.py.
   Hides Shell chrome (header, footer, dialogs) and forces
   black-on-white text on the tool's main content area.
   ============================================ */
@media print {
  .site-header,
  .site-footer,
  .shell-palette,
  .shell-settings-modal,
  dialog[open] {
    display: none !important;
  }
  html,
  body,
  .shell-main {
    background: #fff !important;
    color: #000 !important;
  }
  a {
    color: #000 !important;
    text-decoration: underline;
  }
  .panel,
  .field,
  .result-tile,
  .qr-output {
    background: #fff !important;
    color: #000 !important;
    box-shadow: none !important;
    border-color: #000 !important;
  }
}
"""


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"_print_css_bootstrap: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def already_has_print_block(css_text: str) -> bool:
    """True if the CSS already has any @media print block (regardless of
    whether it was added by this script or written by hand)."""
    return "@media print" in css_text


def append_print_block(css_path: Path) -> str:
    """Append the standard print block if missing. Returns 'added' | 'already'."""
    try:
        original = css_path.read_text(encoding="utf-8", errors="ignore")
    except OSError as e:
        sys.stderr.write(f"_print_css_bootstrap: cannot read {css_path}: {e}\n")
        return "error"
    if already_has_print_block(original):
        return "already"
    try:
        # Ensure a trailing newline before the block so the appended block
        # starts on its own line.
        sep = "" if original.endswith("\n") else "\n"
        css_path.write_text(original + sep + PRINT_BLOCK, encoding="utf-8")
    except OSError as e:
        sys.stderr.write(f"_print_css_bootstrap: cannot write {css_path}: {e}\n")
        return "error"
    return "added"


def main() -> int:
    parser = argparse.ArgumentParser(description="Story 2.7/2.8 @media print bootstrap")
    parser.add_argument("--slug", action="append",
                        help="Restrict to one or more slugs (repeatable)")
    parser.add_argument("--wave2", action="store_true",
                        help="Process only Wave-2 slugs")
    parser.add_argument("--wave3", action="store_true",
                        help="Process only Wave-3 slugs (default)")
    parser.add_argument("--all", action="store_true",
                        help="Process both Wave-2 + Wave-3 slugs")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).parent)
    # Default scope is Wave-3 (the current story); --all widens to both waves.
    if args.wave2 and not args.wave3 and not args.all:
        default_slugs = list(WAVE_2_SLUGS)
    elif args.all:
        default_slugs = list(WAVE_2_SLUGS) + list(WAVE_3_SLUGS)
    else:
        default_slugs = list(WAVE_3_SLUGS)
    slugs = args.slug if args.slug else default_slugs

    added = 0
    already = 0
    errors = 0
    for slug in slugs:
        css_path = repo_root / "tools" / slug / f"{slug}.css"
        if not css_path.is_file():
            sys.stderr.write(f"_print_css_bootstrap: missing {css_path}\n")
            errors += 1
            continue
        result = append_print_block(css_path)
        if result == "added":
            added += 1
            if not args.quiet:
                print(f"  +   {slug}: added @media print block")
        elif result == "already":
            already += 1
            if not args.quiet:
                print(f"  =   {slug}: @media print already present")
        else:
            errors += 1

    print(f"_print_css_bootstrap: {added} added, {already} already, {errors} errors ({len(slugs)} total)")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())