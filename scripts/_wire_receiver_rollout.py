#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_wire_receiver_rollout.py — Wire HT.challengeReceiver into the 9
non-canary Discovery quizzes.

Story 10.12 roll-out (AI-E10-3 follow-up). Mirrors the canary pattern
in tools/packs/discovery/spirit-animal/spirit-animal-core.js (lines
329-401) into each of the 9 remaining Discovery quizzes, and adds
the challenge-receiver.js <script> tag to each index.html.

Patches applied to each <slug>-core.js (in order):
  1. Insert landing block before `var handle = window.HT.quiz.open({`
  2. Append stash + CTA block at end of onComplete handler, after
     `animateBars(body);` (gated on getChallengeBlob)

Patches applied to each <slug>/index.html:
  1. Insert `<script src="../../assets/js/challenge-receiver.js" defer></script>`
     immediately after the shell-thin.js script tag

Idempotent: re-running detects existing patterns and emits a SKIP
line instead of double-patching.

Usage
-----
  python scripts/_wire_receiver_rollout.py          # patch all 9
  python scripts/_wire_receiver_rollout.py --check  # exit 1 if any quiz is unwired
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Force UTF-8 on stdout/stderr so the report renders correctly on
# Windows consoles (cp1252) without crashing on ≥ / ✗ / non-ASCII quotes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass


REPO_ROOT = Path(__file__).resolve().parent.parent

# The 9 quizzes that need the receiver wired (canary: spirit-animal)
TARGET_SLUGS = [
    "future-partner",
    "what-would-you-do",
    "decision-style",
    "friend-match",
    "car-finder",
    "fortune-cookie",
    "time-traveler-therapist",
    "dream-job",
    "last-meal",
]


# --- Patch templates ---------------------------------------------------------

# Heading block: inserted before `var handle = window.HT.quiz.open({`
LANDING_BLOCK = """    // Story 10.12 — if the URL carries ?c=<blob>, mount the
    // receiver-side challenge banner above the quiz. Privacy
    // default: blind.
    var QUIZ_SLUG = '{slug}';
    if (window.HT.challengeReceiver) {
      var r = window.HT.challengeReceiver.landing(QUIZ_SLUG, mount.parentNode, {{}});
      if (r && r.ok) {{
        // Continue to mount the quiz below the banner.
      }}
    }}

"""

# Stash + CTA block: appended at end of onComplete, after animateBars(body)
STASH_BLOCK = """
        // Story 10.12 — on completion during a challenge flow, stash
        // local answers and redirect to the compare view.
        if (window.HT.challengeReceiver) {
          var blob = window.HT.challengeReceiver.getChallengeBlob();
          if (blob) {
            window.HT.challengeReceiver.stashLocalAnswers(QUIZ_SLUG, answers);
            // Build compare URL: same folder, compare.html. The
            // receiver JS on that page will read both the blob
            // (from URL) and the local stash.
            var compareUrl = './compare.html?c=' + encodeURIComponent(blob);
            // Inject a CTA into the reveal panel.
            var cta = document.createElement('a');
            cta.href = compareUrl;
            cta.className = 'btn btn-primary challenge-compare-cta';
            cta.setAttribute('role', 'button');
            cta.textContent = 'See your compatibility →';
            cta.style.marginTop = '0.75rem';
            cta.style.display = 'inline-block';
            var actions = body.querySelector('.disc-actions');
            if (actions) {
              actions.appendChild(cta);
              cta.focus();
            }
          }
        }
"""


def wire_core(slug: str, src: str) -> tuple[str, str]:
    """Patch the <slug>-core.js source. Returns (new_src, status)."""
    # 1. Idempotency: if QUIZ_SLUG already exists for this slug, skip.
    if f"var QUIZ_SLUG = '{slug}'" in src:
        return src, "SKIP (already wired)"

    # 2. Insert landing block before `var handle = window.HT.quiz.open({`
    open_marker = "var handle = window.HT.quiz.open({"
    if open_marker not in src:
        return src, f"FAIL (missing '{open_marker}')"
    # Avoid str.format() — the JS template contains literal {} braces.
    landing = LANDING_BLOCK.replace("{slug}", slug)
    src = src.replace(open_marker, landing + open_marker, 1)

    # 3. Append stash + CTA block after `animateBars(body);` (the last
    #    occurrence in the file — the onComplete handler is the only
    #    caller, so this is robust)
    last_animate = src.rfind("animateBars(body);")
    if last_animate == -1:
        return src, "FAIL (missing 'animateBars(body);')"
    # Insert the stash block right after the animateBars line
    insert_point = last_animate + len("animateBars(body);")
    src = src[:insert_point] + STASH_BLOCK + src[insert_point:]

    return src, "WROTE"


def wire_index(slug: str, src: str) -> tuple[str, str]:
    """Patch the <slug>/index.html source. Returns (new_src, status)."""
    # 1. Idempotency: if the script tag is already present, skip.
    if "assets/js/challenge-receiver.js" in src:
        return src, "SKIP (already wired)"

    # 2. Insert the challenge-receiver.js script tag immediately after
    #    the shell-thin.js script tag (matches spirit-animal's order).
    shell_thin_tag = '<script src="../../assets/js/shell-thin.js" defer></script>'
    if shell_thin_tag not in src:
        return src, f"FAIL (missing '{shell_thin_tag}')"
    receiver_tag = '<script src="../../assets/js/challenge-receiver.js" defer></script>'
    src = src.replace(
        shell_thin_tag,
        shell_thin_tag + "\n  " + receiver_tag,
        1,
    )
    return src, "WROTE"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="_wire_receiver_rollout — wire HT.challengeReceiver into the 9 non-canary Discovery quizzes.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if any quiz is unwired (core + index + compare.html).",
    )
    args = parser.parse_args(argv)

    summary = {"core_wrote": 0, "core_skip": 0, "core_fail": 0,
               "index_wrote": 0, "index_skip": 0, "index_fail": 0,
               "compare_missing": 0}

    for slug in TARGET_SLUGS:
        core_path = REPO_ROOT / "tools/packs/discovery" / slug / f"{slug}-core.js"
        index_path = REPO_ROOT / "tools/packs/discovery" / slug / "index.html"
        compare_path = REPO_ROOT / "tools/packs/discovery" / slug / "compare.html"

        if not core_path.is_file():
            print(f"  FAIL    {slug}/<slug>-core.js [missing]")
            summary["core_fail"] += 1
            continue
        if not index_path.is_file():
            print(f"  FAIL    {slug}/index.html [missing]")
            summary["index_fail"] += 1
            continue
        if not compare_path.is_file():
            print(f"  FAIL    {slug}/compare.html [missing]")
            summary["compare_missing"] += 1
            continue

        core_src = core_path.read_text(encoding="utf-8")
        index_src = index_path.read_text(encoding="utf-8")

        new_core, core_status = wire_core(slug, core_src)
        new_index, index_status = wire_index(slug, index_src)

        if args.check:
            if core_status.startswith("FAIL"):
                print(f"  FAIL    {slug}/<slug>-core.js — {core_status}")
            if index_status.startswith("FAIL"):
                print(f"  FAIL    {slug}/index.html — {index_status}")
        else:
            if core_status == "WROTE":
                core_path.write_text(new_core, encoding="utf-8", newline="\n")
            if index_status == "WROTE":
                index_path.write_text(new_index, encoding="utf-8", newline="\n")

        # Tally
        if core_status == "WROTE":
            summary["core_wrote"] += 1
        elif core_status.startswith("SKIP"):
            summary["core_skip"] += 1
        else:
            summary["core_fail"] += 1
        if index_status == "WROTE":
            summary["index_wrote"] += 1
        elif index_status.startswith("SKIP"):
            summary["index_skip"] += 1
        else:
            summary["index_fail"] += 1

        print(f"  {slug}: core={core_status} | index={index_status}")

    print()
    print(f"Summary: core {summary['core_wrote']}W / {summary['core_skip']}S / {summary['core_fail']}F — "
          f"index {summary['index_wrote']}W / {summary['index_skip']}S / {summary['index_fail']}F — "
          f"compare missing {summary['compare_missing']}")

    if args.check:
        ok = (summary["core_fail"] == 0 and summary["index_fail"] == 0
              and summary["compare_missing"] == 0)
        return 0 if ok else 1
    return 0 if summary["core_fail"] == 0 and summary["index_fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
