#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_fix_quiz_open_questions.py — restore the `questions: QUESTIONS` arg
to HT.quiz.open({...}) in the 3 Discovery core.js files where the
earlier `_adopt_results_render.py` patcher accidentally dropped it.

Without `questions`, HT.quiz.open renders an empty quiz-mount
(section visible but no quiz-card chrome inside) — which the
new `_browser_smoke.py` regression harness correctly catches.

Affected files (per `_dbg_questions_arg.py`):
  tools/packs/discovery/time-traveler-therapist/time-traveler-therapist-core.js
  tools/packs/discovery/dream-job/dream-job-core.js
  tools/packs/discovery/last-meal/last-meal-core.js

Idempotent: re-running is a no-op (regex already matches the
correct `questions: QUESTIONS,` once it's added).

Usage: `python scripts/_fix_quiz_open_questions.py [--check]`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [
    "tools/packs/discovery/time-traveler-therapist/time-traveler-therapist-core.js",
    "tools/packs/discovery/dream-job/dream-job-core.js",
    "tools/packs/discovery/last-meal/last-meal-core.js",
]

CHECK_ONLY = "--check" in sys.argv

# Match `HT.quiz.open({` ... `mount: mount,` and ensure
# `questions: QUESTIONS,` is on the next line.
INJECT = "      questions: QUESTIONS,\n"


def fix(src: str) -> str:
    # Idempotency check: if already has the line, return unchanged.
    if re.search(r'questions:\s*QUESTIONS,', src):
        return src
    # Find `HT.quiz.open({` then the next `mount: mount,` line.
    pattern = re.compile(
        r'(window\.HT\.quiz\.open\(\{\s*\n\s*mount:\s*mount,)',
        re.MULTILINE,
    )
    new, n = pattern.subn(r'\1\n' + INJECT.rstrip('\n').rstrip(',') + ',', src)
    # Above substitution produces `mount: mount,,questions:...` (double
    # comma). Use a clean replacement instead:
    new, n = pattern.subn(r'\1\n' + INJECT, src)
    if n != 1:
        raise RuntimeError(f"expected exactly 1 substitution, got {n}")
    return new


def main():
    wrote = 0
    skipped = 0
    failed = 0
    for rel in TARGETS:
        p = ROOT / rel
        if not p.is_file():
            print(f"  MISSING  {rel}")
            failed += 1
            continue
        before = p.read_text(encoding="utf-8")
        try:
            after = fix(before)
        except RuntimeError as e:
            print(f"  FAIL     {rel}: {e}")
            failed += 1
            continue
        if after == before:
            print(f"  SKIP     {rel} (already has questions: QUESTIONS)")
            skipped += 1
            continue
        if CHECK_ONLY:
            print(f"  CHECK    {rel} (would inject questions: QUESTIONS)")
            skipped += 1
            continue
        p.write_text(after, encoding="utf-8")
        print(f"  WROTE    {rel}")
        wrote += 1
    print(f"\nfix-quiz-open-questions: wrote={wrote} skipped={skipped} failed={failed}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()