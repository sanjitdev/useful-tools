"""
_audit_wave_3.py — Story 2.8 Wave-3 audit.

Thin wrapper over _wave_lib.audit_wave().

Usage:
    python scripts/_audit_wave_3.py           # audit + append Wave-3 section
    python scripts/_audit_wave_3.py --quiet   # suppress per-tool progress

Exit codes: 0 = pass, 1 = below bar, 2 = missing script, 3 = I/O.
"""

from __future__ import annotations

import sys

from _wave_lib import audit_wave

# Wave-3 selection (matches _promote_wave_3.py's roster).
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


if __name__ == "__main__":
    sys.exit(audit_wave(wave_id=3, slug_list=WAVE_3_SLUGS))
