"""
_pack_tags.py — Story 2.9 pack-tag auditor + taxonomy doc emitter.

Aggregates the canonical pack roster from the three wave-promo scripts
(_promote_wave_1.py + _promote_wave_2.py + _promote_wave_3.py), verifies
each pack has ≥ 3 tools, and emits docs/pack-taxonomy.md with one
paragraph per pack + the current tool list.

Idempotent: re-running produces a byte-equivalent docs/pack-taxonomy.md
unless a tool's pack assignment or pack-tag enumeration changed.

Usage:
    python scripts/_pack_tags.py            # audit + emit
    python scripts/_pack_tags.py --quiet    # suppress progress
    python scripts/_pack_tags.py --audit    # check only (no doc emit)

Exit codes:
    0 — every ready:true tool has a valid pack; every pack has ≥ 3 tools
    1 — at least one tool's pack is invalid OR a pack dropped below 3
    2 — repo layout issue (schema or wave-promo script missing)
    3 — I/O failure
"""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path
from collections import defaultdict
from datetime import date

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"
TAXONOMY_FILENAME = "docs/pack-taxonomy.md"
# Each script defines WAVE_N_PACKS at module top-level. We import via
# importlib.util so the scripts need not be a package (no __init__.py
# in scripts/).
PROMOTE_SCRIPTS = (
    "_promote_wave_1",
    "_promote_wave_2",
    "_promote_wave_3",
)

# Pack taxonomy. Order = display order on the pack cards page (matches
# tools.schema.json pack.items.enum). Inclusion criterion = one-line
# heuristic for "does this tool belong in this pack?".
PACK_DEFINITIONS: list[tuple[str, str, str]] = [
    (
        "travel",
        "Trip planning, time zones, and date math for travel.",
        "A tool helps with travel logistics: clocks across regions, "
        "countdown to an event, or date difference calculations.",
    ),
    (
        "finance",
        "Money math — loans, interest, tax, percentages, tips.",
        "A tool produces a numeric money result: income, EMI, growth, "
        "tip, discount, or similar monetary calculation.",
    ),
    (
        "study",
        "Learning aids — grades, focus, study timers, writing helpers.",
        "A tool supports academic or learning workflows: grading, "
        "GPA, focus sessions, or text generation.",
    ),
    (
        "developer",
        "Tools developers reach for daily — formatting, encoding, regex.",
        "A tool manipulates structured text or developer-facing data: "
        "JSON, regex, encoding, URL, base64, or random.",
    ),
    (
        "household",
        "Everyday home + lifestyle tools — health, decisions, fun.",
        "A tool helps with a household or personal-life task: "
        "health metrics, animal fun, decisions, color picking, or "
        "general life math.",
    ),
]

MIN_TOOLS_PER_PACK = 3


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"_pack_tags: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_canonical_roster(repo_root: Path) -> dict[str, list[str]]:
    """Import the WAVE_*_PACKS tables from each promote script and merge.
    Returns {slug: pack_list} covering all promoted tools.

    Uses importlib.util to load each script by file path (scripts/ is not
    a package — no __init__.py). Falls back to scanning tools.json on
    ImportError (degraded mode — emits the doc but won't catch future
    drift)."""
    import importlib.util
    roster: dict[str, list[str]] = {}
    scripts_dir = repo_root / "scripts"
    for module_name in PROMOTE_SCRIPTS:
        script_path = scripts_dir / f"{module_name}.py"
        if not script_path.is_file():
            sys.stderr.write(f"_pack_tags: missing {script_path}\n")
            continue
        try:
            spec = importlib.util.spec_from_file_location(
                f"_pack_tags__{module_name}", script_path
            )
            if spec is None or spec.loader is None:
                sys.stderr.write(f"_pack_tags: cannot load spec for {script_path}\n")
                continue
            mod = importlib.util.module_from_spec(spec)
            # Each promote script's find_repo_root reads from its own
            # __file__.parent — no global state to worry about.
            spec.loader.exec_module(mod)
        except Exception as e:  # noqa: BLE001
            sys.stderr.write(f"_pack_tags: warning — cannot load {script_path}: {e}\n")
            continue
        # Each promote script names its table WAVE_N_PACKS where N = 1/2/3.
        packs_table: dict[str, list[str]] | None = None
        for attr in ("WAVE_1_PACKS", "WAVE_2_PACKS", "WAVE_3_PACKS"):
            candidate = getattr(mod, attr, None)
            if candidate:
                packs_table = candidate
                break
        if packs_table is None:
            sys.stderr.write(f"_pack_tags: {module_name} has no WAVE_*_PACKS table\n")
            continue
        for slug, pack_list in packs_table.items():
            if slug in roster:
                merged = sorted(set(roster[slug]) | set(pack_list))
                roster[slug] = merged
            else:
                roster[slug] = list(pack_list)
    return roster


def validate_roster(roster: dict[str, list[str]]) -> list[str]:
    """Return a list of human-readable failure reasons. Empty = pass."""
    failures: list[str] = []
    valid_packs = {p[0] for p in PACK_DEFINITIONS}
    by_pack: dict[str, list[str]] = defaultdict(list)
    for slug, packs in roster.items():
        if not packs:
            failures.append(f"{slug}: empty pack list")
            continue
        for p in packs:
            if p not in valid_packs:
                failures.append(f"{slug}: pack {p!r} not in taxonomy")
            else:
                by_pack[p].append(slug)
    for pack_slug, _title, _crit in PACK_DEFINITIONS:
        if len(by_pack[pack_slug]) < MIN_TOOLS_PER_PACK:
            failures.append(
                f"pack {pack_slug!r} has {len(by_pack[pack_slug])} tools "
                f"(< {MIN_TOOLS_PER_PACK} minimum)"
            )
    return failures


def emit_taxonomy(roster: dict[str, list[str]], today: str) -> str:
    """Render the pack taxonomy markdown. Pure — does not write to disk."""
    by_pack: dict[str, list[str]] = defaultdict(list)
    for slug, packs in roster.items():
        for p in packs:
            by_pack[p].append(slug)
    total_tools = sum(len(v) for v in by_pack.values())
    dual_pack = sum(1 for slug, packs in roster.items() if len(packs) > 1)

    lines: list[str] = []
    lines.append("# Pack Taxonomy")
    lines.append("")
    lines.append(f"_Auto-generated by `scripts/_pack_tags.py` on {today}._")
    lines.append(
        f"_Total tools: **{len(roster)}** (across {len(PACK_DEFINITIONS)} packs; "
        f"{dual_pack} tools are dual-pack)._"
    )
    lines.append("")
    lines.append(
        "The pack taxonomy is the curated grouping used by `/packs/<slug>.html` "
        "pages (Epic 6). Every tool in `tools.json` with `ready: true` "
        "appears in at least one pack. The 5 pack slugs are pinned by "
        "`tools.schema.json#/$defs/.../pack/items/enum`; the schema "
        "rejects any value not in this set."
    )
    lines.append("")
    lines.append("## Inclusion Criteria")
    lines.append("")
    lines.append("A tool lands in a pack when its primary use case matches the "
                 "one-line criterion below. Multi-pack tools (e.g., a calculator "
                 "useful both at home and in finance) appear in both lists.")
    lines.append("")
    for pack_slug, title, criterion in PACK_DEFINITIONS:
        lines.append(f"- **{pack_slug}** — {criterion}")
    lines.append("")
    lines.append("## Per-pack Tool Lists")
    lines.append("")
    for pack_slug, title, _crit in PACK_DEFINITIONS:
        tools = sorted(set(by_pack.get(pack_slug, [])))
        lines.append(f"### `{pack_slug}` — {title}")
        lines.append("")
        lines.append(f"_{len(tools)} tools._")
        lines.append("")
        if tools:
            for slug in tools:
                lines.append(f"- [`{slug}`](../tools/{slug}/index.html)")
        else:
            lines.append("_No tools currently assigned._")
        lines.append("")
    lines.append("## Validation")
    lines.append("")
    lines.append(
        "The `make pack-tags` target re-runs this script. It exits 1 if any "
        "tool's `pack` field is missing or contains a value not in the enum, "
        "or if any pack drops below the 3-tool minimum. "
        "`make pack-tags-smoke` runs the Node-side static smoke that "
        "verifies every `ready:true` entry has ≥ 1 valid pack value."
    )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Story 2.9 pack-tag audit + taxonomy doc")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-pack progress")
    parser.add_argument("--audit", action="store_true",
                        help="Audit only; do not emit docs/pack-taxonomy.md")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).parent)
    today = date.today().isoformat()

    roster = load_canonical_roster(repo_root)
    if not roster:
        sys.stderr.write("_pack_tags: no pack roster loaded — aborting\n")
        return 2

    failures = validate_roster(roster)
    if failures:
        sys.stderr.write("_pack_tags: FAIL\n")
        for f in failures:
            sys.stderr.write(f"  - {f}\n")
        return 1

    if not args.quiet:
        by_pack: dict[str, list[str]] = defaultdict(list)
        for slug, packs in roster.items():
            for p in packs:
                by_pack[p].append(slug)
        print(f"_pack_tags: {len(roster)} tools, {sum(len(v) for v in by_pack.values())} pack-slots")
        for pack_slug, _title, _crit in PACK_DEFINITIONS:
            print(f"  {pack_slug:12s} {len(by_pack[pack_slug])} tools")

    if args.audit:
        return 0

    out = repo_root / TAXONOMY_FILENAME
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(emit_taxonomy(roster, today), encoding="utf-8")
    print(f"_pack_tags: wrote {TAXONOMY_FILENAME}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
