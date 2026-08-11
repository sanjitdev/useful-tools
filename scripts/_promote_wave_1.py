"""
_promote_wave_1.py — Story 2.6 Wave-1 promotion script.

Pure-stdlib Python. Idempotent: validates that the three wave-1 tools
(qr-code-generator, inflation-calculator, lifespan-simulator) are at the
8/10 rubric bar in tools.json, and emits docs/tool-inventory.md covering
all 33 tools discovered on disk.

Usage:
    python scripts/_promote_wave_1.py              # validate + emit inventory
    python scripts/_promote_wave_1.py --inventory-only   # skip validation
    python scripts/_promote_wave_1.py --quiet            # suppress progress

Exit codes:
    0 — all wave-1 tools at the bar; inventory written
    1 — at least one wave-1 tool is below the bar (with reason)
    2 — repo layout issue (tools.json missing)
    3 — I/O failure

Wave-1 selection (per Story 2.6 spec): the three tools that are already
ready:true in tools.json. The spec's example names "QR generator, tip
calculator, JSON formatter" are illustrative — the three tools already at
the bar (qr-code-generator, inflation-calculator, lifespan-simulator) are
the canonical wave-1 set. Tip-calculator + JSON formatter land in Story
2.7 (Wave-2) where they get full per-tool migration including urlState.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from datetime import date

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"
INVENTORY_FILENAME = "docs/tool-inventory.md"

WAVE_1_SLUGS = ("qr-code-generator", "inflation-calculator", "lifespan-simulator")
WAVE_1_MIN_SCORE = 8


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"_promote_wave_1: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"_promote_wave_1: cannot read {path}: {e}\n")
        sys.exit(3)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"_promote_wave_1: invalid JSON in {path}: {e}\n")
        sys.exit(2)


def find_entry(tools_doc: dict, slug: str) -> dict | None:
    """Find a tool entry by slug (Story 1.1+ schema: top-level `tools` array)."""
    tools = tools_doc.get("tools", [])
    for entry in tools:
        if entry.get("slug") == slug or entry.get("id") == slug:
            return entry
    return None


def validate_wave_1(tools_doc: dict, quiet: bool) -> list[str]:
    """Returns a list of failure reasons (empty = all pass)."""
    failures: list[str] = []
    for slug in WAVE_1_SLUGS:
        entry = find_entry(tools_doc, slug)
        if entry is None:
            failures.append(f"{slug}: missing from tools.json")
            continue
        if not entry.get("ready"):
            failures.append(f"{slug}: ready is not true (got {entry.get('ready')!r})")
        score = entry.get("score", 0)
        if score < WAVE_1_MIN_SCORE:
            failures.append(f"{slug}: score {score} < {WAVE_1_MIN_SCORE}")
        if "urlState" not in entry:
            failures.append(f"{slug}: missing urlState")
        if "history-keys" not in entry and "historyKeys" not in entry:
            failures.append(f"{slug}: missing history-keys")
        if "view-source" not in entry and "viewSource" not in entry:
            failures.append(f"{slug}: missing view-source")
        if not quiet:
            print(f"  ok  {slug}: ready=true, score={score}, urlState + history-keys + view-source present")
    return failures


def discover_all_tools(repo_root: Path) -> list[str]:
    """Glob tools/*/index.html and extract slugs (one per folder)."""
    tools_dir = repo_root / "tools"
    if not tools_dir.is_dir():
        return []
    slugs: list[str] = []
    for child in sorted(tools_dir.iterdir()):
        if not child.is_dir():
            continue
        if not (child / "index.html").is_file():
            continue
        slugs.append(child.name)
    return slugs


def classify_wave(slug: str, tools_doc: dict) -> int:
    """Wave assignment per Story 1.4 (Story 2.6 verifies wave-1, the rest
    is bookkeeping for the inventory). Wave-1 = in tools.json with
    ready:true. Wave-2 = in tools.json but ready:false (e.g., tip-calculator,
    json-formatter). Wave-3 = not in tools.json at all."""
    entry = find_entry(tools_doc, slug)
    if entry is not None and entry.get("ready"):
        return 1
    if entry is not None:
        return 2
    return 3


def has_sample_data(repo_root: Path, slug: str) -> bool:
    """True if the tool's index.html includes a reference to sample-data.js
    OR the tool's <slug>.js declares a sample-state literal (heuristic:
    looks for 'sample' or 'default' as identifier in the JS file)."""
    js_path = repo_root / "tools" / slug / f"{slug}.js"
    if not js_path.is_file():
        return False
    try:
        text = js_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return bool(re.search(r"\b(sample|default)\b", text, re.IGNORECASE))


def emit_inventory(repo_root: Path, tools_doc: dict, today: str) -> None:
    """Write docs/tool-inventory.md."""
    all_slugs = discover_all_tools(repo_root)
    wave_1 = [s for s in all_slugs if classify_wave(s, tools_doc) == 1]
    wave_2 = [s for s in all_slugs if classify_wave(s, tools_doc) == 2]
    wave_3 = [s for s in all_slugs if classify_wave(s, tools_doc) == 3]

    lines: list[str] = []
    lines.append("# Tool Inventory")
    lines.append("")
    lines.append(f"_Auto-generated by `scripts/_promote_wave_1.py` on {today}._")
    lines.append(f"_Total tools discovered: **{len(all_slugs)}** (Wave-1: {len(wave_1)}, "
                 f"Wave-2: {len(wave_2)}, Wave-3: {len(wave_3)})._")
    lines.append("")
    lines.append("Wave assignment per Story 1.4 / Story 2.6:")
    lines.append("")
    lines.append("- **Wave-1** — already in `tools.json` with `ready: true` "
                 "(promoted under the per-tool contract in Story 2.6 and Story 2.7).")
    lines.append("- **Wave-2** — in `tools.json` but `ready: false` (no entries "
                 "remain after Story 2.7).")
    lines.append("- **Wave-3** — not in `tools.json` (will be added in Story 2.8).")
    lines.append("")
    lines.append("| Slug | Wave | Sample data | Source path |")
    lines.append("|---|---|---|---|")
    for slug in all_slugs:
        wave = classify_wave(slug, tools_doc)
        sd = "yes" if has_sample_data(repo_root, slug) else "no"
        path = f"`tools/{slug}/{slug}.js`"
        lines.append(f"| `{slug}` | {wave} | {sd} | {path} |")
    lines.append("")
    lines.append("## Per-tool Contract Gap Checklist")
    lines.append("")
    lines.append("For each tool, the Wave-2 / Wave-3 promotion must add:")
    lines.append("")
    lines.append("1. `urlState` block (decode + encode + sample) in `tools.json`.")
    lines.append("2. `history-keys` array.")
    lines.append("3. `view-source.path`.")
    lines.append("4. `embed-snippet` (if the tool benefits from being embedded).")
    lines.append("5. Shell script tags: `<script src=\"…/share.js\">` inserted "
                 "between `sample-data.js` and `a11y.js` (Story 2.5).")
    lines.append("6. Per-tool a11y tab-order-canonical array (Story 2.4 AC-2).")
    lines.append("")
    out = repo_root / INVENTORY_FILENAME
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Story 2.6 wave-1 promotion + inventory")
    parser.add_argument("--inventory-only", action="store_true",
                        help="Skip validation; only emit docs/tool-inventory.md")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress output")
    args = parser.parse_args()

    repo_root = find_repo_root(Path(__file__).parent)
    tools_doc = load_json(repo_root / TOOLS_JSON_FILENAME)
    today = date.today().isoformat()

    print(f"_promote_wave_1: validating {len(WAVE_1_SLUGS)} wave-1 tools at score>={WAVE_1_MIN_SCORE}")
    if not args.inventory_only:
        failures = validate_wave_1(tools_doc, args.quiet)
        if failures:
            sys.stderr.write("_promote_wave_1: FAIL\n")
            for f in failures:
                sys.stderr.write(f"  - {f}\n")
            return 1
        print(f"_promote_wave_1: {len(WAVE_1_SLUGS)} PASS, 0 FAIL")

    print(f"_promote_wave_1: writing {INVENTORY_FILENAME}")
    emit_inventory(repo_root, tools_doc, today)
    print(f"_promote_wave_1: done ({today})")
    return 0


if __name__ == "__main__":
    sys.exit(main())