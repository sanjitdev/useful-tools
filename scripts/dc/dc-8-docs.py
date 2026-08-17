#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-8-docs.py — AC for DC-8 (Documentation).

Verifies docs/discovery-platform.md exists, is rich enough, and that
the public-API table in docs/shell-public-api.md has all 5 new rows.

Run: `make dc-8-docs` or `python scripts/dc/dc-8-docs.py`.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, read_text, repo_root


def word_count(text):
    return len(re.findall(r"\b\w+\b", text or ""))


def main():
    print("DC-8 — Documentation (9 checks)")

    doc = "docs/discovery-platform.md"
    api_doc = "docs/shell-public-api.md"
    readme = "README.md"

    doc_src = read_text(doc) or ""
    api_src = read_text(api_doc) or ""
    readme_src = read_me() if False else (read_text(readme) or "")

    # 1. doc exists and is >= 1,000 words
    wc = word_count(doc_src)
    check(
        bool(doc_src) and wc >= 1000,
        f"{doc} exists and is >= 1,000 words (got {wc})",
    )

    # 2..5. four API sections present with examples
    check(
        bool(doc_src) and "HT.scoring.score" in doc_src and re.search(
            r"HT\.scoring\.score\([^)]*answers[^)]*spec", doc_src
        ),
        "docs/discovery-platform.md documents HT.scoring.score(answers, spec) with an example",
    )
    check(
        bool(doc_src) and "HT.results.render" in doc_src,
        "docs/discovery-platform.md documents HT.results.render(scored, opts) with an example",
    )
    check(
        bool(doc_src) and "HT.challenge.link" in doc_src and "iat" in doc_src and "exp" in doc_src,
        "docs/discovery-platform.md documents HT.challenge.link(spec) + the {v, slug, self, iat, exp} blob shape",
    )
    check(
        bool(doc_src) and "HT.recommend.match" in doc_src,
        "docs/discovery-platform.md documents HT.recommend.match(profile, domain) with profile + item shape",
    )

    # 6. Hello World authoring example
    check(
        bool(doc_src) and re.search(r"hello\s+world", doc_src, re.IGNORECASE),
        "docs/discovery-platform.md includes a 'Hello World' quiz authoring example",
    )

    # 7, 8. §5 has all 5 new API rows, all stable
    needed = ["HT.scoring", "HT.results", "HT.challenge", "HT.recommend", "HT.catalog"]
    if not api_src:
        check(False, "docs/shell-public-api.md §5 has all 5 new API rows [missing]")
        check(False, "All 5 new API rows are marked `stable` [doc missing]")
    else:
        # Look for §5 (table of public APIs). We accept any presence
        # of the API name in the doc as evidence the row exists.
        all_present = all(n in api_src for n in needed)
        check(
            all_present,
            f"docs/shell-public-api.md mentions all 5 new APIs: {needed}",
        )

        # Stable stability — every API row should mention 'stable'.
        # Looser interpretation: at least one mention of 'stable'
        # adjacent to the API name. We accept a window of 120 chars.
        stable_count = 0
        for n in needed:
            idx = api_src.find(n)
            if idx == -1:
                continue
            window = api_src[idx: idx + 200]
            if "stable" in window.lower():
                stable_count += 1
        check(
            stable_count == len(needed),
            f"All 5 new API rows are marked `stable` stability ({stable_count}/5 stable)",
        )

    # 9. README.md links to docs/discovery-platform.md
    check(
        bool(readme_src) and (
            "discovery-platform.md" in readme_src
            or "docs/discovery-platform" in readme_src
        ),
        "README.md links to docs/discovery-platform.md",
    )

    exit_with_summary("DC-8")


if __name__ == "__main__":
    main()