"""
_promote_wave_2.py — Story 2.7 Wave-2 promotion script.

Thin wrapper over _wave_lib.promote_wave(). All scaffolding (find_repo_root,
load_json, build_entry, validate_entry, write_json) lives in _wave_lib.
This file defines the Wave-2-specific data only (slugs + pack / category /
keyword dictionaries) and delegates.

Usage:
    python scripts/_promote_wave_2.py              # promote all 15
    python scripts/_promote_wave_2.py --slug <s>   # single tool
    python scripts/_promote_wave_2.py --quiet      # suppress progress
    python scripts/_promote_wave_2.py --dry-run    # compute only

Exit codes: 0 = pass, 1 = below bar, 2 = repo layout, 3 = I/O.
"""

from __future__ import annotations

import sys

from _wave_lib import promote_wave

# Wave-2 selection (matches _print_css_bootstrap.py + _smoke_wave_2_pages.js).
# Sorted by JS bytes desc.
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

# Curated pack taxonomy (Story 2.9 will expand). Each Wave-2 tool
# maps to exactly one primary pack per its domain.
WAVE_2_PACKS: dict[str, list[str]] = {
    "bd-tax-calculator":   ["finance"],
    "animal-race":         ["household"],
    "space-calculator":    ["household"],
    "age-calculator":      ["household"],
    "random-tools":        ["developer"],
    "world-clock":         ["travel"],
    "grade-calculator":    ["study"],
    "decision-wheel":      ["household"],
    "gpa-calculator":      ["study"],
    "loan-calculator":     ["finance"],
    "countdown-to-date":   ["travel"],
    "markdown-previewer":  ["developer"],
    "calorie-estimator":   ["household"],
    "stopwatch":           ["study"],
    "compound-interest":   ["finance"],
}

# Categories are coarse-grained (rubric scope, not pack).
WAVE_2_CATEGORIES: dict[str, str] = {
    "bd-tax-calculator":   "Converters & Calculators",
    "animal-race":         "Fun",
    "space-calculator":    "Converters & Calculators",
    "age-calculator":      "Converters & Calculators",
    "random-tools":        "Developer",
    "world-clock":         "Converters & Calculators",
    "grade-calculator":    "Converters & Calculators",
    "decision-wheel":      "Fun",
    "gpa-calculator":      "Converters & Calculators",
    "loan-calculator":     "Converters & Calculators",
    "countdown-to-date":   "Converters & Calculators",
    "markdown-previewer":  "Developer",
    "calorie-estimator":   "Converters & Calculators",
    "stopwatch":           "Time",
    "compound-interest":   "Converters & Calculators",
}

# Search keywords. Auto-derived from title + slug for the seed, but
# curated per tool for the common search cases.
WAVE_2_KEYWORDS: dict[str, list[str]] = {
    "bd-tax-calculator":   ["bangladesh", "tax", "salary", "finance", "bd", "income", "tds"],
    "animal-race":         ["race", "animal", "fun", "game", "random", "simulator"],
    "space-calculator":    ["space", "area", "square", "room", "house", "household"],
    "age-calculator":      ["age", "birthday", "date", "years", "household"],
    "random-tools":        ["random", "picker", "number", "list", "shuffle", "developer"],
    "world-clock":         ["clock", "time", "world", "timezone", "travel", "gmt", "utc"],
    "grade-calculator":    ["grade", "score", "marks", "gpa", "study", "school"],
    "decision-wheel":      ["decision", "wheel", "spinner", "random", "picker", "fun"],
    "gpa-calculator":      ["gpa", "grade", "points", "average", "study", "college"],
    "loan-calculator":     ["loan", "emi", "interest", "mortgage", "finance", "borrow"],
    "countdown-to-date":   ["countdown", "date", "timer", "days", "travel", "event"],
    "markdown-previewer":  ["markdown", "md", "preview", "render", "developer", "html"],
    "calorie-estimator":   ["calorie", "tdee", "bmr", "diet", "weight", "household"],
    "stopwatch":           ["stopwatch", "timer", "lap", "study", "time", "seconds"],
    "compound-interest":   ["compound", "interest", "investment", "finance", "savings", "apy"],
}


if __name__ == "__main__":
    sys.exit(promote_wave(
        wave_id=2,
        slug_list=WAVE_2_SLUGS,
        packs=WAVE_2_PACKS,
        categories=WAVE_2_CATEGORIES,
        keywords=WAVE_2_KEYWORDS,
    ))
