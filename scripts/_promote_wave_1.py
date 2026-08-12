"""
_promote_wave_1.py — Story 2.6 Wave-1 promotion + inventory script.

Thin wrapper over _wave_lib.promote_wave_1(). Wave-1 is special: the
three tools are already at the 8/10 bar in tools.json (promoted earlier),
so this script (a) validates that the entries still meet the bar and
(b) emits docs/tool-inventory.md. There is no per-tool promotion to
perform.

Usage:
    python scripts/_promote_wave_1.py              # validate + emit inventory
    python scripts/_promote_wave_1.py --inventory-only   # skip validation
    python scripts/_promote_wave_1.py --quiet            # suppress progress

Exit codes:
    0 — all wave-1 tools at the bar; inventory written
    1 — at least one wave-1 tool is below the bar (with reason)
    2 — repo layout issue (tools.json missing)
    3 — I/O failure
"""

from __future__ import annotations

import sys

from _wave_lib import promote_wave_1

WAVE_1_SLUGS = ("qr-code-generator", "inflation-calculator", "lifespan-simulator")

# Wave-1 packs (Story 2.9 — sourced from the tools.json entries that
# Story 2.6 promoted). Multi-pack tools are kept; schema permits this
# (the items are uniqueItems and the array is minItems: 1).
WAVE_1_PACKS: dict[str, list[str]] = {
    "qr-code-generator":   ["developer"],
    "inflation-calculator": ["finance", "household"],
    "lifespan-simulator":  ["household", "study"],
}


if __name__ == "__main__":
    sys.exit(promote_wave_1(
        wave_1_slugs=WAVE_1_SLUGS,
        wave_1_packs=WAVE_1_PACKS,
    ))
