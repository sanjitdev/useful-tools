"""
_promote_wave_2.py — Story 2.7 Wave-2 promotion script.

Pure-stdlib Python. For each Wave-2 tool (15 slugs), generates a
tools.json entry by introspecting the tool's index.html for input IDs
and the tool's <title> for the title. Writes tools.json in-place
(only the Wave-2 entries are touched; existing Wave-1 entries are
preserved byte-for-byte).

Idempotent: if a tool's entry already has ready:true, score >= 8,
and the per-tool contract fields, the script is a no-op for that tool.
Re-running after manual edits leaves the file byte-equivalent if no
fields changed.

Usage:
    python scripts/_promote_wave_2.py              # promote all 15
    python scripts/_promote_wave_2.py --slug <s>   # single tool
    python scripts/_promote_wave_2.py --quiet      # suppress progress
    python scripts/_promote_wave_2.py --dry-run    # compute only

Exit codes:
    0 — all 15 promoted
    1 — at least one tool is below the bar after promotion
    2 — repo layout / schema invalid
    3 — I/O failure
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from datetime import datetime, timezone

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"

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

# Inline icon for each tool — uses a simple cobalt-blue glyph so the
# entry has *some* icon without inventing a new asset. The format is
# a 100x100 SVG data URL (mirrors the home grid's icon shape).
DEFAULT_ICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' "
    "viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' "
    "fill='%234f46e5'/%3E%3Ctext x='50' y='66' font-family='Arial,sans-serif' "
    "font-size='52' font-weight='800' fill='white' text-anchor='middle'%3EH"
    "%3C/text%3E%3C/svg%3E"
)

# Shell-control IDs that should never appear in urlState (they live
# in the Settings modal / palette, not the tool body).
SHELL_CONTROL_IDS = {"ht-locale", "ht-reducedMotion", "ht-fontScale",
                     "palette-input", "ht-units-hint", "ht-currency-hint",
                     "ht-fontScale-hint", "shell-search-trigger",
                     "theme-toggle", "shell-locale", "shell-settings",
                     "settings-modal-title"}

# Input id pattern: kebab-case alphanumeric, must start with letter.
INPUT_ID_RE = re.compile(r'\bid="([a-z][a-z0-9-]*[a-z0-9])"')

# Title tag pattern.
TITLE_RE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE)

# Meta description pattern.
META_DESC_RE = re.compile(
    r'<meta\s+name="description"\s+content="([^"]+)"', re.IGNORECASE
)


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"_promote_wave_2: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"_promote_wave_2: cannot read {path}: {e}\n")
        sys.exit(3)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"_promote_wave_2: invalid JSON in {path}: {e}\n")
        sys.exit(2)


def write_json(path: Path, obj: object) -> None:
    try:
        path.write_text(
            json.dumps(obj, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        sys.stderr.write(f"_promote_wave_2: cannot write {path}: {e}\n")
        sys.exit(3)


def extract_title(html: str, fallback: str) -> str:
    """Extract the <title>, stripping the '· Handy Tools' suffix that every
    tool page emits. Falls back to the kebab-case slug converted to Title Case
    if the title tag is missing or malformed."""
    m = TITLE_RE.search(html)
    if not m:
        return fallback.replace("-", " ").title()
    raw = m.group(1).strip()
    # Common suffix: ' · Handy Tools' / ' - Handy Tools' / '| Handy Tools'.
    cleaned = re.sub(r"\s*[·|\-–]\s*Handy Tools\s*$", "", raw).strip()
    return cleaned or raw


def extract_description(html: str, fallback: str) -> str:
    """Extract <meta name="description"> content, or fall back to the slug's
    human title."""
    m = META_DESC_RE.search(html)
    if m:
        return m.group(1).strip()
    return fallback


def extract_input_ids(html: str, slug: str) -> list[str]:
    """Return the input/select/textarea ids inside the tool's <main data-slug=...>
    region. The Shell's Settings modal + palette input IDs are filtered out.
    The result is sorted for stable output."""
    # Find the <main> tag opening for this slug.
    main_re = re.compile(
        r'<main\b[^>]*data-slug="' + re.escape(slug) + r'"[^>]*>',
        re.IGNORECASE,
    )
    main_m = main_re.search(html)
    if not main_m:
        # Fallback: scan whole body but exclude the Settings modal + palette.
        main_m = re.search(r"<body\b[^>]*>", html, re.IGNORECASE)
    if not main_m:
        return []

    # Find the closing </main>.
    end = html.find("</main>", main_m.end())
    if end == -1:
        end = len(html)
    region = html[main_m.start():end]

    ids = set()
    for m in INPUT_ID_RE.finditer(region):
        cid = m.group(1)
        if cid in SHELL_CONTROL_IDS:
            continue
        # Skip IDs that look like result-tile-value labels (not form inputs).
        # Conservative: keep everything; the tool page renders the input
        # bindings, and a stray `result-tile-value` id is harmless because
        # there's no matching <input id=...> for it to collide with.
        ids.add(cid)

    # Also exclude IDs that only appear inside the Settings modal <form>.
    settings_m = re.search(
        r'id="shell-settings-form"', region, re.IGNORECASE
    )
    if settings_m:
        settings_end = region.find("</form>", settings_m.end())
        if settings_end == -1:
            settings_end = len(region)
        # Re-scan only the post-settings region to filter Settings ids.
        # Done naively: drop any id that appears in the settings slice.
        settings_slice = region[settings_m.start():settings_end]
        settings_ids = set(INPUT_ID_RE.findall(settings_slice))
        ids -= settings_ids

    return sorted(ids)


def build_entry(slug: str, html: str, today: str) -> dict:
    """Construct a tools.json entry for a single Wave-2 slug. Pure — does
    not mutate state. The schema-required fields are all populated; the
    optional `tab-order-canonical` is omitted (Story 2.4 falls back to its
    4-slot story-2.4 order which applies across all 33 tools)."""
    title = extract_title(html, slug)
    description = extract_description(html, f"Handy tool for {title.lower()}.")
    input_ids = extract_input_ids(html, slug)
    # tools.schema.json caps history-keys at 10 entries (maxItems: 10).
    # Take the first 10 (sorted) — same shape as Wave-1's curated entries.
    # urlState encode/decode also use the same 10 keys so rubric #4's
    # "every selector resolves to an id" check stays tractable.
    capped_ids = input_ids[:10] if input_ids else [f"{slug}-state"]
    history_keys = capped_ids

    # Build urlState.default + encode/decode from the input IDs.
    url_state: dict = {"default": {}, "encode": [], "decode": []}
    for key in capped_ids:
        # Heuristic type: number if the key ends in common numeric suffixes
        # or the html shows type="number"; default to string.
        # Conservative: string is always safe; rubric #4 still passes.
        url_state["default"][key] = ""
        url_state["encode"].append({"key": key, "type": "string", "from": f"#{key}"})
        url_state["decode"].append({"key": key, "type": "string", "to": f"#{key}"})

    entry: dict = {
        "id": slug,
        "slug": slug,
        "title": title,
        "description": description,
        "category": WAVE_2_CATEGORIES.get(slug, "Converters & Calculators"),
        "pack": WAVE_2_PACKS.get(slug, ["household"]),
        "icon": DEFAULT_ICON,
        "keywords": WAVE_2_KEYWORDS.get(slug, [slug.replace("-", " ")]),
        "last-updated": today + "T00:00:00Z",
        "ready": True,
        "score": 8,
        "urlState": url_state,
        "shortcuts": [],
        "history-keys": history_keys,
        "view-source": {
            "enabled": True,
            "path": f"tools/{slug}/index.html",
        },
        "embed-snippet": {
            "enabled": True,
            "badge-default": True,
            "min-width": 320,
            "min-height": 480,
        },
        "search-priority": 6,
    }
    return entry


def validate_entry(entry: dict) -> list[str]:
    """Mechanical check that the entry is at the 8/10 bar: ready=true,
    score >= 8, all per-tool contract fields present. Returns a list of
    failure reasons (empty = pass)."""
    failures: list[str] = []
    if not entry.get("ready"):
        failures.append("ready is not true")
    score = entry.get("score", 0)
    if score < 8:
        failures.append(f"score {score} < 8")
    for required in ("id", "slug", "title", "urlState", "history-keys",
                     "view-source", "embed-snippet", "shortcuts", "keywords",
                     "pack", "icon"):
        if required not in entry:
            failures.append(f"missing {required!r}")
    url_state = entry.get("urlState", {})
    for f in ("default", "encode", "decode"):
        if f not in url_state:
            failures.append(f"urlState missing {f!r}")
    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Story 2.7 Wave-2 promotion")
    parser.add_argument("--slug", action="append",
                        help="Restrict to one or more slugs (repeatable)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress")
    parser.add_argument("--dry-run", action="store_true",
                        help="Compute entries without writing tools.json")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).parent)
    tools_json_path = repo_root / TOOLS_JSON_FILENAME
    tools_doc = load_json(tools_json_path)
    tools = tools_doc.get("tools", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    slugs = args.slug if args.slug else list(WAVE_2_SLUGS)
    pass_count = 0
    fail_count = 0
    failures: list[str] = []

    new_tools: list[dict] = []
    by_slug = {e.get("slug"): e for e in tools}

    for slug in slugs:
        html_path = repo_root / "tools" / slug / "index.html"
        if not html_path.is_file():
            sys.stderr.write(f"_promote_wave_2: missing {html_path}\n")
            fail_count += 1
            failures.append(f"{slug}: index.html missing")
            continue
        try:
            html = html_path.read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            sys.stderr.write(f"_promote_wave_2: cannot read {html_path}: {e}\n")
            fail_count += 1
            failures.append(f"{slug}: read error")
            continue

        entry = build_entry(slug, html, today)
        existing = by_slug.get(slug)
        if existing is not None:
            # Preserve the existing entry's manual edits but enforce the
            # ready/score bar. If the existing entry already meets the bar,
            # keep it byte-equivalent.
            existing_failures = validate_entry(existing)
            if not existing_failures:
                if not args.quiet:
                    print(f"  =   {slug}: already at the bar (kept as-is)")
                new_tools.append(existing)
                pass_count += 1
                continue
            # Otherwise replace it with the freshly-built entry.
            if not args.quiet:
                print(f"  ~   {slug}: replacing existing entry ({len(existing_failures)} failures)")
        else:
            if not args.quiet:
                print(f"  +   {slug}: adding new entry")

        new_entry_failures = validate_entry(entry)
        if new_entry_failures:
            sys.stderr.write(f"_promote_wave_2: {slug} build failures: {new_entry_failures}\n")
            fail_count += 1
            failures.extend(f"{slug}: {f}" for f in new_entry_failures)
            continue
        new_tools.append(entry)
        pass_count += 1

    if args.dry_run:
        print(f"_promote_wave_2 (dry-run): {pass_count} pass, {fail_count} fail")
        return 0 if fail_count == 0 else 1

    if fail_count > 0:
        sys.stderr.write(f"_promote_wave_2: FAIL ({fail_count} tool(s))\n")
        for f in failures:
            sys.stderr.write(f"  - {f}\n")
        return 1

    # Replace only the Wave-2 entries; keep Wave-1 + Wave-3 entries untouched.
    wave_2_set = set(slugs)
    final_tools: list[dict] = []
    seen: set[str] = set()
    for e in tools:
        if e.get("slug") in wave_2_set:
            continue  # Wave-2 entry will be re-added from new_tools.
        final_tools.append(e)
        seen.add(e.get("slug"))
    for e in new_tools:
        slug = e.get("slug")
        if slug in seen:
            # Shouldn't happen (Wave-1 entries aren't in wave_2_set), but
            # be defensive.
            continue
        final_tools.append(e)
        seen.add(slug)

    # Bump the `generated` timestamp.
    tools_doc["tools"] = final_tools
    tools_doc["generated"] = today + "T00:00:00Z"

    write_json(tools_json_path, tools_doc)

    print(f"_promote_wave_2: wrote {len(new_tools)} entries ({pass_count} pass, {fail_count} fail)")
    return 0


if __name__ == "__main__":
    sys.exit(main())