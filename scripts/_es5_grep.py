"""
_es5_grep.py — Story 2.10 ES5-pattern gate.

Scans assets/js/** for the two ES5 anti-patterns that Story 2.10 migrated
away from: `var` declarations and Array.prototype.concat calls. The
migrated files (utils.js, layout.js, theme.js) MUST be free of both — if
anyone re-introduces ES5 patterns, the gate fails.

(Note: the migrated files deliberately use string concatenation with `+`
inside template-literal-free blocks where the original did — only
`Array.prototype.concat(` is banned, not all `+` string building. The
script targets the canonical anti-patterns only.)

Scope:
    - utils.js, layout.js, theme.js (the shared migrated files): MUST
      be free of `var ` (with trailing space, to avoid matching `var`
      inside identifiers like `myvar`) and `.concat(`.
    - assets/js/** (broader sweep): catches stragglers in other JS files
      (tool scripts) that still use `.concat(`. `.concat(` is the more
      dangerous of the two because it's an API-level anti-pattern that
      doesn't modern-code away cleanly.

Usage:
    python scripts/_es5_grep.py
    python scripts/_es5_grep.py --quiet

Exit codes:
    0 — no ES5 anti-patterns found
    1 — at least one anti-pattern found (gate fails)
    2 — repo layout issue (assets/js/ missing)
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

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_JS = REPO_ROOT / "assets" / "js"

# The three files Story 2.10 migrated. Scanned with the strictest rules
# (no `var` declarations AT ALL, no `.concat(` calls).
MIGRATED_FILES = (
    "utils.js",
    "layout.js",
    "theme.js",
)

# Path prefixes that qualify as "migrated" (the gate fires on `var`).
# Used instead of basename-only matching so a future tool script at
# e.g. assets/js/tools/utils.js is not promoted to the strict tier.
MIGRATED_PATH_PREFIXES = (
    "assets/js/utils.js",
    "assets/js/layout.js",
    "assets/js/theme.js",
)

def is_migrated(rel_path: str) -> bool:
    """True iff rel_path is exactly one of the three migrated files
    (no path-prefix collision with future tool scripts)."""
    return rel_path in MIGRATED_PATH_PREFIXES

# `\bvar\s+` matches `var ` (with trailing whitespace) — avoids matching
# identifiers like `myvar` or `my_var`. The migration is required to
# replace `var foo` with `let foo` or `const foo`, so any match here
# means the migration regressed (or someone added new ES5 code).
VAR_PATTERN = re.compile(r"\bvar\s+")

# `.concat(` matches any Array.prototype.concat call (including
# String.prototype.concat, which is the same anti-pattern). The
# migration is required to use `[...a, ...b]` or template literals
# instead.
CONCAT_PATTERN = re.compile(r"\.concat\(")


def find_files(root: Path) -> list[Path]:
    """Yield all .js files under root, sorted for stable output."""
    if not root.exists():
        return []
    return sorted(p for p in root.rglob("*.js") if p.is_file())


def scan(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (line_no, line, pattern_name) for each violation."""
    violations: list[tuple[int, str, str]] = []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        # Surface as a violation so the maintainer notices the read
        # failure rather than silently passing.
        violations.append((0, f"<read error: {e}>", "read-error"))
        return violations
    for ln, line in enumerate(text.splitlines(), start=1):
        if VAR_PATTERN.search(line):
            violations.append((ln, line.rstrip("\r"), "var"))
        if CONCAT_PATTERN.search(line):
            violations.append((ln, line.rstrip("\r"), "concat"))
    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-file passing output; only print violations.",
    )
    args = parser.parse_args()

    if not ASSETS_JS.exists():
        print(f"FAIL: {ASSETS_JS} not found", file=sys.stderr)
        return 2

    all_files = find_files(ASSETS_JS)

    # Vacuous-pass guard: assets/js/ exists but contains zero .js files
    # would otherwise print PASS without scanning anything. Treat this
    # the same as a missing directory (exit 2) so the maintainer notices.
    if not all_files:
        print(f"FAIL: no .js files found under {ASSETS_JS}", file=sys.stderr)
        return 2

    # Phase 1: strict scan of the three migrated files (var + concat).
    # Phase 2: relaxed scan of assets/js/** (concat only — the broader
    # tool JS may still use legitimate `var` patterns in tool-internal
    # code if needed, but `.concat(` is universally banned).
    migrated_violations: list[tuple[Path, list]] = []
    concat_violations: list[tuple[Path, list]] = []
    read_errors: list[tuple[Path, str]] = []

    for path in all_files:
        rel = path.relative_to(REPO_ROOT).as_posix()
        violations = scan(path)
        if not violations:
            if not args.quiet:
                print(f"  ok    {rel}")
            continue
        # Read errors get their own bucket — they fail the gate
        # unconditionally (a file we couldn't read could contain any
        # number of anti-patterns).
        read_error_hits = [v for v in violations if v[2] == "read-error"]
        if read_error_hits:
            read_errors.append((path, read_error_hits[0][1]))
            if not args.quiet:
                print(f"  FAIL  {rel}  (read error)")
            continue
        # Filter: if this is a migrated file, every violation fails.
        var_hits = [v for v in violations if v[2] == "var"]
        concat_hits = [v for v in violations if v[2] == "concat"]
        if is_migrated(rel) and var_hits:
            migrated_violations.append((path, var_hits))
        if concat_hits:
            # Even for non-migrated files, .concat( is banned.
            concat_violations.append((path, concat_hits))
        if not args.quiet and (is_migrated(rel) or concat_hits):
            print(f"  FAIL  {rel}")

    # Report
    failed = False
    if read_errors:
        print("\nUnreadable files (gate fails — could not scan):", file=sys.stderr)
        for path, msg in read_errors:
            rel = path.relative_to(REPO_ROOT).as_posix()
            print(f"  {rel}: {msg}", file=sys.stderr)
        failed = True
    if migrated_violations:
        print("\nMIGRATED FILES — `var` declarations found:", file=sys.stderr)
        for path, hits in migrated_violations:
            rel = path.relative_to(REPO_ROOT).as_posix()
            for ln, line, kind in hits:
                print(f"  {rel}:{ln}: [{kind}] {line.strip()}", file=sys.stderr)
        failed = True
    if concat_violations:
        print("\n`.concat(` calls found (banned across assets/js/**):", file=sys.stderr)
        for path, hits in concat_violations:
            rel = path.relative_to(REPO_ROOT).as_posix()
            for ln, line, kind in hits:
                print(f"  {rel}:{ln}: [{kind}] {line.strip()}", file=sys.stderr)
        failed = True

    if failed:
        print("\nes5-grep: FAIL — ES5 anti-patterns or scan errors detected", file=sys.stderr)
        return 1
    print(f"\nes5-grep: PASS — scanned {len(all_files)} JS files, no ES5 anti-patterns")
    return 0


if __name__ == "__main__":
    sys.exit(main())
