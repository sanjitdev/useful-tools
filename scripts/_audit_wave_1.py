"""
_audit_wave_1.py — Story 2.6 Wave-1 audit.

Thin wrapper over _wave_lib.audit_wave(). Runs rubric-lint.py against
each Wave-1 tool, captures the per-criterion table, and emits
docs/quality-audit.md.

Usage:
    python scripts/_audit_wave_1.py           # audit + emit docs/quality-audit.md
    python scripts/_audit_wave_1.py --quiet   # suppress per-tool progress

Exit codes: 0 = pass, 1 = below bar, 2 = missing script, 3 = I/O.
"""

from __future__ import annotations

import sys

from _wave_lib import audit_wave

# Wave-1 selection (matches _promote_wave_1.py).
WAVE_1_SLUGS = ("qr-code-generator", "inflation-calculator", "lifespan-simulator")


if __name__ == "__main__":
    sys.exit(audit_wave(wave_id=1, slug_list=WAVE_1_SLUGS))
