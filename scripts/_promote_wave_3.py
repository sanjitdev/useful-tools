"""
_promote_wave_3.py — Story 2.8 Wave-3 promotion script.

Thin wrapper over _wave_lib.promote_wave(). All scaffolding lives in
_wave_lib. This file defines the Wave-3-specific data only.

Usage:
    python scripts/_promote_wave_3.py              # promote all 17
    python scripts/_promote_wave_3.py --slug <s>   # single tool
    python scripts/_promote_wave_3.py --quiet      # suppress progress
    python scripts/_promote_wave_3.py --dry-run    # compute only

Exit codes: 0 = pass, 1 = below bar, 2 = repo layout, 3 = I/O.
"""

from __future__ import annotations

import sys

from _wave_lib import promote_wave

# Wave-3 selection (matches _print_css_bootstrap.py extension +
# _smoke_wave_3_pages.js). Sorted by JS bytes desc.
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

# Curated pack taxonomy. Each Wave-3 tool maps to exactly one primary
# pack per its domain (Travel, Finance, Study, Developer, Household).
WAVE_3_PACKS: dict[str, list[str]] = {
    "json-formatter":          ["developer"],
    "color-tools":             ["fun"],
    "date-difference":         ["travel"],
    "lorem-ipsum":             ["fun"],
    "pros-cons":               ["fun"],
    "unit-converter":          ["developer"],
    "password-strength":       ["developer"],
    "pomodoro-timer":          ["study"],
    "habit-tracker":           ["fun"],
    "regex-tester":            ["developer"],
    "eisenhower-matrix":       ["fun"],
    "bmi-calculator":          ["household"],
    "word-counter":            ["study"],
    "percentage-calculator":   ["finance"],
    "base64-codec":            ["developer"],
    "tip-calculator":          ["finance"],
    "url-codec":               ["developer"],
}

# Categories are coarse-grained (rubric scope, not pack).
WAVE_3_CATEGORIES: dict[str, str] = {
    "json-formatter":          "Developer",
    "color-tools":             "Fun",
    "date-difference":         "Converters & Calculators",
    "lorem-ipsum":             "Fun",
    "pros-cons":               "Fun",
    "unit-converter":          "Converters & Calculators",
    "password-strength":       "Developer",
    "pomodoro-timer":          "Time",
    "habit-tracker":           "Fun",
    "regex-tester":            "Developer",
    "eisenhower-matrix":       "Fun",
    "bmi-calculator":          "Converters & Calculators",
    "word-counter":            "Developer",
    "percentage-calculator":   "Converters & Calculators",
    "base64-codec":            "Developer",
    "tip-calculator":          "Converters & Calculators",
    "url-codec":               "Developer",
}

# Search keywords. Auto-derived from title + slug for the seed, but
# curated per tool for the common search cases.
WAVE_3_KEYWORDS: dict[str, list[str]] = {
    "json-formatter":          ["json", "format", "pretty", "minify", "validate", "developer", "lint"],
    "color-tools":             ["color", "picker", "hex", "rgb", "hsl", "household", "palette"],
    "date-difference":         ["date", "difference", "between", "days", "duration", "travel"],
    "lorem-ipsum":             ["lorem", "ipsum", "placeholder", "text", "filler", "study", "generator"],
    "pros-cons":               ["pros", "cons", "decision", "matrix", "compare", "household", "list"],
    "unit-converter":          ["unit", "converter", "metric", "imperial", "convert", "developer", "length"],
    "password-strength":       ["password", "strength", "entropy", "security", "checker", "developer"],
    "pomodoro-timer":          ["pomodoro", "timer", "focus", "study", "session", "break"],
    "habit-tracker":           ["habit", "daily", "streak", "household", "log"],
    "regex-tester":            ["regex", "regular", "expression", "test", "match", "developer", "pattern"],
    "eisenhower-matrix":       ["eisenhower", "matrix", "urgent", "important", "todo", "household"],
    "bmi-calculator":          ["bmi", "body", "mass", "index", "weight", "height", "household"],
    "word-counter":            ["word", "counter", "count", "characters", "text", "study", "length"],
    "percentage-calculator":   ["percentage", "percent", "ratio", "finance", "calc", "tip"],
    "base64-codec":            ["base64", "encode", "decode", "codec", "developer", "binary"],
    "tip-calculator":          ["tip", "calculator", "restaurant", "gratuity", "finance", "percent"],
    "url-codec":               ["url", "encode", "decode", "percent", "escape", "developer", "uri"],
}


if __name__ == "__main__":
    sys.exit(promote_wave(
        wave_id=3,
        slug_list=WAVE_3_SLUGS,
        packs=WAVE_3_PACKS,
        categories=WAVE_3_CATEGORIES,
        keywords=WAVE_3_KEYWORDS,
    ))
