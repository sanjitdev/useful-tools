#!/usr/bin/env python3
"""Splice the inline header-search region into the non-tool chrome pages.

Story 10.20: the chrome.html header region now carries the inline
header-search include between `<a class="shell-header-lab">...</a>` and
`<button class="theme-toggle">`. The legacy chrome pages
(packs/*.html, quality.html, tools/date-picker-lab/, tools/packs/) were
generated from the OLD chrome.html that had a
`<button class="shell-search-trigger">` button instead. This script
splits the swap so the page chrome byte-aligns with chrome.html without
the drift check flagging `missing_header_search_region` or the
`tag_mismatch` on the site-header landmark.

The transformation is:
  <button class="shell-search-trigger" type="button" aria-label="Search tools">
    <svg .../></svg>
    <span>Search</span>
  </button>
becomes:
  <!-- shell:header-search -->
  <div class="shell-header-search" id="header-search" role="search" data-open="false">
    <button class="shell-header-search-icon" id="header-search-icon" type="button" aria-label="Open search" aria-controls="header-search-panel" aria-expanded="false">
      <svg .../></svg>
    </button>
    <input .../>
    <div class="shell-header-search-panel" id="header-search-panel" role="region" aria-label="Search results" hidden>
      <ul class="shell-header-search-list" id="header-search-listbox" role="listbox" aria-label="Tools">
        <li class="shell-header-search-empty" role="presentation">No recent tools yet</li>
      </ul>
      <div id="header-search-live" class="shell-sr-only" aria-live="polite" aria-atomic="true"></div>
      <div class="shell-header-search-footer">
        <span class="shell-header-search-footer-hints">↑↓ Navigate · Enter Open · Esc Close</span>
        <button class="shell-header-search-show-all" id="header-search-show-all" type="button" data-open-palette>Show all actions ⌘⇧K</button>
      </div>
    </div>
  </div>
  <!-- /shell:header-search -->

The canonical inline block is read from assets/shell/header-search.html
(its own `<!-- shell:header-search -->...<!-- /shell:header-search -->`
canonical region).

Run via:

  python splice-header-search.py [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
HEADER_SEARCH_REL = Path("assets/shell/header-search.html")
HEADER_SEARCH_REGION_RE = re.compile(
    r"<!-- shell:header-search -->\s*(.*?)\s*<!-- /shell:header-search -->", re.DOTALL
)
SEARCH_TRIGGER_RE = re.compile(
    r'<button\s+class="shell-search-trigger"\s+type="button"\s+aria-label="Search tools">'
    r".*?</button>",
    re.DOTALL,
)
# Story 10.20 followup: legacy pages that already carry the OLD
# header-search include (button-as-icon pattern, separate `<input>`,
# no input-wrap) need re-splicing to the NEW always-visible input
# pattern. Match the entire OLD `<div class="shell-header-search">`
# block including its comment markers.
OLD_HEADER_SEARCH_RE = re.compile(
    r"<!-- shell:header-search -->.*?<!-- /shell:header-search -->",
    re.DOTALL,
)
# Discovery tool pages use `../../../../assets/...` paths (one more
# level of `../` than the regular tool pages). Inject the eager
# chrome-header-search.css <link> after the last existing stylesheet
# <link> so the pill input + dropdown panel are styled at first paint
# without waiting for the lazy HT.headerSearch.open() trigger.
DISCOVERY_HEADER_SEARCH_CSS_LINK = (
    '<link rel="stylesheet" '
    'href=\"../../../../assets/css/chrome-header-search.css\">'
)


def splice_discovery_header_search_css(text: str) -> str:
    """Idempotently inject the eager chrome-header-search.css <link>
    into a discovery tool page <head>. Re-runs are no-ops once the link
    is present.
    """
    if "chrome-header-search.css" in text:
        return text
    matches = list(
        re.finditer(r"<link\s+rel=\"stylesheet\"\s+[^>]*>", text, re.IGNORECASE)
    )
    if not matches:
        return text
    last = matches[-1]
    end = last.end()
    return text[:end] + "\n  " + DISCOVERY_HEADER_SEARCH_CSS_LINK + text[end:]

PAGES = [
    "packs/developer.html",
    "packs/disc.html",
    "packs/finance.html",
    "packs/fun.html",
    "packs/household.html",
    "packs/study.html",
    "packs/travel.html",
    "quality.html",
    "tools/date-picker-lab/index.html",
    "tools/packs/index.html",
    # Story 10.20 patch: the discovery tool pages use a hand-maintained
    # chrome that pre-dates the shell-template splice (no inline tools.json,
    # `../../../../` brand link). They still carry the legacy
    # `<button class="shell-search-trigger">` trigger that opens the modal
    # overlay, which now needs to be the new inline search input so the
    # discovery tools match the rest of the site's chrome.
    "tools/packs/discovery/car-finder/index.html",
    "tools/packs/discovery/car-finder/compare.html",
    "tools/packs/discovery/decision-style/index.html",
    "tools/packs/discovery/decision-style/compare.html",
    "tools/packs/discovery/dream-job/index.html",
    "tools/packs/discovery/dream-job/compare.html",
    "tools/packs/discovery/fortune-cookie/index.html",
    "tools/packs/discovery/fortune-cookie/compare.html",
    "tools/packs/discovery/friend-match/index.html",
    "tools/packs/discovery/friend-match/compare.html",
    "tools/packs/discovery/future-partner/index.html",
    "tools/packs/discovery/future-partner/compare.html",
    "tools/packs/discovery/last-meal/index.html",
    "tools/packs/discovery/last-meal/compare.html",
    "tools/packs/discovery/spirit-animal/index.html",
    "tools/packs/discovery/spirit-animal/compare.html",
    "tools/packs/discovery/time-traveler-therapist/index.html",
    "tools/packs/discovery/time-traveler-therapist/compare.html",
    "tools/packs/discovery/what-would-you-do/index.html",
    "tools/packs/discovery/what-would-you-do/compare.html",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--root", default=str(REPO_ROOT), help="explicit repo root"
    )
    args = parser.parse_args()
    root = Path(args.root).resolve()

    # Read the canonical header-search region.
    hs_path = root / HEADER_SEARCH_REL
    if not hs_path.is_file():
        sys.stderr.write(f"splice-header-search: missing {hs_path}\n")
        return 2
    hs_text = hs_path.read_text(encoding="utf-8")
    hs_match = HEADER_SEARCH_REGION_RE.search(hs_text)
    if not hs_match:
        sys.stderr.write(
            f"splice-header-search: header-search.html missing "
            f"shell:header-search markers\n"
        )
        return 2
    # The header-search bytes need to be prefixed with the chrome
    # comment block describing them (mirrors the chrome.html header
    # block). Use the existing comment prefix from chrome.html.
    hs_block = hs_match.group(0)  # includes the marker comments

    failures = 0
    for rel in PAGES:
        path = root / rel
        if not path.is_file():
            print(f"  skip {rel}  (missing)")
            continue
        text = path.read_text(encoding="utf-8")
        # Story 10.20 followup: pages already carrying the new
        # input-wrap AND the (now-removed) "Show all actions" CTA inside
        # the OLD header-search region must be re-spliced so the CTA is
        # stripped. Force a Path B re-splice in that case BEFORE the
        # idempotent short-circuit below.
        if (
            'class="shell-header-search-input-wrap"' in text
            and 'shell-header-search-show-all' in text
        ):
            m_old = OLD_HEADER_SEARCH_RE.search(text)
            if m_old:
                new_text = splice_discovery_header_search_css(
                    text[: m_old.start()]
                    + "      " + hs_block + "\n      "
                    + text[m_old.end():]
                )
                reason = "re-spliced: removed Show all actions CTA"
                if args.dry_run:
                    print(f"  would-write {rel}  ({reason})")
                    continue
                try:
                    path.write_text(new_text, encoding="utf-8")
                except OSError as exc:
                    print(f"  FAIL {rel}  (write failed: {exc})")
                    failures += 1
                    continue
                print(f"  wrote {rel}  ({reason})")
                continue
        # The new canonical markup carries the input-wrap div. Pages with
        # only the old button-based markup are out of date and need a
        # re-splice. Pages already up-to-date short-circuit on the
        # input-wrap check so re-runs are idempotent.
        if 'class="shell-header-search-input-wrap"' in text:
            print(f"  ok   {rel}  (already has header-search)")
            continue
        # Path A: page is on the original chrome (button.shell-search-trigger)
        # and has never been spliced. Replace the legacy button.
        m_legacy = SEARCH_TRIGGER_RE.search(text)
        # Path B: page was spliced once with the OLD header-search
        # markup (button-as-icon). Replace the entire OLD block.
        m_old = OLD_HEADER_SEARCH_RE.search(text)
        if m_legacy:
            # Discovery tool pages use a `../../../../assets/...` path
            # (one more level than the standard tool pages) so the eager
            # CSS link is different from the regular tool-page version.
            # Inject the eager <link> right after the last existing
            # stylesheet <link> in <head> so the pill input + dropdown
            # panel are styled at first paint.
            new_text = splice_discovery_header_search_css(
                text[: m_legacy.start()]
                + "      " + hs_block + "\n      "
                + text[m_legacy.end():]
            )
            reason = "spliced from shell-search-trigger button"
        elif m_old:
            new_text = splice_discovery_header_search_css(
                text[: m_old.start()]
                + "      " + hs_block + "\n      "
                + text[m_old.end():]
            )
            reason = "re-spliced from old header-search markup"
        else:
            print(f"  FAIL {rel}  (no anchor: shell-search-trigger or old header-search)")
            failures += 1
            continue
        if args.dry_run:
            print(f"  would-write {rel}  ({reason})")
            continue
        try:
            path.write_text(new_text, encoding="utf-8")
        except OSError as exc:
            print(f"  FAIL {rel}  (write failed: {exc})")
            failures += 1
            continue
        print(f"  wrote {rel}  ({reason})")
    if failures:
        print(f"splice-header-search: {failures} failure(s)")
        return 1
    print("splice-header-search: all non-tool pages spliced")
    return 0


if __name__ == "__main__":
    sys.exit(main())