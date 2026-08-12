"""
_audit_wave_2.py — Story 2.7 Wave-2 audit.

Thin wrapper over _wave_lib.audit_wave().

Usage:
    python scripts/_audit_wave_2.py           # audit + append Wave-2 section
    python scripts/_audit_wave_2.py --quiet   # suppress per-tool progress

Exit codes: 0 = pass, 1 = below bar, 2 = missing script, 3 = I/O.
"""

from __future__ import annotations

import sys

from _wave_lib import audit_wave

# Wave-2 selection (matches _promote_wave_2.py's roster + _print_css_bootstrap.py).
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


if __name__ == "__main__":
    sys.exit(audit_wave(wave_id=2, slug_list=WAVE_2_SLUGS))
