#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_gen_compare_pages.py — Generate compare.html for the 9 non-canary
Discovery quizzes, mirroring tools/packs/discovery/spirit-animal/compare.html.

Story 10.12 roll-out (AI-E10-3): the canary pattern in spirit-animal
extends to every quiz in packs.discovery.entries[]. The 9 compare.html
pages are byte-equivalent to the canary except for slug + title + h1
substitutions. Generators are idempotent — re-running produces no
diff against a clean run.

Usage
-----
  python scripts/_gen_compare_pages.py           # generate all 9
  python scripts/_gen_compare_pages.py --check  # exit 1 if any drift

The script writes each output to tools/packs/discovery/<slug>/compare.html.
"""
from __future__ import annotations

import argparse
import json
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
TOOLS_JSON = REPO_ROOT / "tools.json"
CANARY_COMPARE = REPO_ROOT / "tools/packs/discovery/spirit-animal/compare.html"

# Substrings from the canary that identify the canary slug in three places
# (the inline IIFE substitution list — landing/readLocalAnswers/compareView).
CANARY_SLUG_REPLACEMENTS = [
    ("'spirit-animal', mount, {})", "'{slug}', mount, {})"),
    ("readLocalAnswers('spirit-animal')", "readLocalAnswers('{slug}')"),
    ("compareView('spirit-animal', local, remote, mount)",
     "compareView('{slug}', local, remote, mount)"),
]


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing
    tools.schema.json. Raises SystemExit if no such directory exists."""
    try:
        cur = start.resolve()
    except OSError as e:
        sys.stderr.write(f"_gen_compare_pages: cannot resolve {start}: {e}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / "tools.schema.json").is_file():
            return parent
    sys.stderr.write(
        f"_gen_compare_pages: cannot locate tools.schema.json in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_quiz_entries() -> list[dict]:
    """Load tools.json → packs.discovery.entries[] in declared order."""
    if not TOOLS_JSON.is_file():
        sys.stderr.write(f"_gen_compare_pages: missing {TOOLS_JSON}\n")
        sys.exit(2)
    try:
        data = json.loads(TOOLS_JSON.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"_gen_compare_pages: invalid JSON in {TOOLS_JSON}: {e}\n")
        sys.exit(2)
    entries = data.get("packs", {}).get("discovery", {}).get("entries", [])
    if not isinstance(entries, list):
        sys.stderr.write("_gen_compare_pages: packs.discovery.entries is not an array.\n")
        sys.exit(2)
    return entries


def render_compare_html(template: str, slug: str, title: str) -> str:
    """Apply slug + title substitutions to the canary template.

    Substitutions (verbatim, only the slug + back-link + h1 change):
      1. data-slug="spirit-animal-compare" → data-slug="<slug>-compare"
      2. <main aria-label="Spirit Animal compatibility" → aria-label="<title> compatibility"
      3. <a href="./index.html" class="back-link">← Spirit Animal</a>
         → <a href="./index.html" class="back-link">← <title></a>
      4. <h1>Spirit Animal — Compatibility</h1>
         → <h1><title> — Compatibility</h1>
      5. <title>Spirit Animal Compatibility · Discover Me</title>
         → <title><title> Compatibility · Discover Me</title>
      6. <meta name="description" content="Spirit Animal challenge ...">
         → <meta name="description" content="<title> challenge ...">
      7. <link rel="stylesheet" href="./spirit-animal.css">
         → <link rel="stylesheet" href="./<slug>.css">
      8. <script src="./spirit-animal-core.js"></script>  (NOT in compare.html)
         — n/a, compare.html doesn't load the core script
      9. inline IIFE: 'spirit-animal', mount, {} → '<slug>', mount, {}
         readLocalAnswers('spirit-animal') → readLocalAnswers('<slug>')
         compareView('spirit-animal', ...) → compareView('<slug>', ...)
    """
    out = template

    # 1. data-slug
    out = out.replace('data-slug="spirit-animal-compare"', f'data-slug="{slug}-compare"')

    # 2. aria-label
    out = out.replace(
        'aria-label="Spirit Animal compatibility"',
        f'aria-label="{title} compatibility"',
    )

    # 3. back-link
    out = out.replace(
        '<a href="./index.html" class="back-link">← Spirit Animal</a>',
        f'<a href="./index.html" class="back-link">← {title}</a>',
    )

    # 4. h1
    out = out.replace(
        '<h1>Spirit Animal — Compatibility</h1>',
        f'<h1>{title} — Compatibility</h1>',
    )

    # 5. <title> in head
    out = out.replace(
        '<title>Spirit Animal Compatibility · Discover Me</title>',
        f'<title>{title} Compatibility · Discover Me</title>',
    )

    # 6. meta description
    out = out.replace(
        '<meta name="description" content="Spirit Animal challenge compatibility — see how your answers match a friend\'s.">',
        f'<meta name="description" content="{title} challenge compatibility — see how your answers match a friend\'s.">',
    )

    # 7. <slug>.css
    out = out.replace(
        'href="./spirit-animal.css"',
        f'href="./{slug}.css"',
    )

    # 8. inline IIFE substitutions (avoid .format() — the JS source
    # contains literal {} braces which would clash with placeholder syntax)
    for old, new in CANARY_SLUG_REPLACEMENTS:
        out = out.replace(old, new.replace("{slug}", slug))

    return out


def title_for_slug(entries: list[dict], slug: str) -> str:
    """Look up the title for a quiz slug; return None if not found."""
    for e in entries:
        if isinstance(e, dict) and e.get("slug") == slug:
            return e.get("title")
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="_gen_compare_pages — generate compare.html for the 9 non-canary Discovery quizzes.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit 1 if any compare.html drifts from the generated canonical version.",
    )
    args = parser.parse_args(argv)

    if not CANARY_COMPARE.is_file():
        sys.stderr.write(
            f"_gen_compare_pages: canary template missing at {CANARY_COMPARE}\n"
        )
        return 2

    template = CANARY_COMPARE.read_text(encoding="utf-8")

    # Non-canary slugs — the 9 quizzes that need compare.html.
    target_slugs = [
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

    entries = load_quiz_entries()

    written = 0
    drift = 0
    for slug in target_slugs:
        title = title_for_slug(entries, slug)
        if not title:
            sys.stderr.write(f"_gen_compare_pages: no entry for slug '{slug}' in tools.json\n")
            return 2

        rendered = render_compare_html(template, slug, title)
        out_path = REPO_ROOT / "tools/packs/discovery" / slug / "compare.html"

        if args.check:
            if not out_path.is_file():
                print(f"  MISSING  {slug}/compare.html")
                drift += 1
                continue
            existing = out_path.read_text(encoding="utf-8")
            if existing != rendered:
                print(f"  DRIFT    {slug}/compare.html")
                drift += 1
            else:
                print(f"  OK       {slug}/compare.html")
        else:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(rendered, encoding="utf-8", newline="\n")
            print(f"  WROTE    {slug}/compare.html")
            written += 1

    if args.check:
        if drift == 0:
            print(f"\nOK — all 9 compare.html files match the canonical generator output.")
            return 0
        print(f"\nDRIFT — {drift} compare.html files differ from the canonical generator output.")
        return 1

    print(f"\nWrote {written} compare.html files under tools/packs/discovery/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
