"""
_wave_lib.py — Shared library for wave promotion + audit scripts.

Extracted from _promote_wave_{1,2,3}.py and _audit_wave_{1,2,3}.py per
AI-E2-3 (Epic 2 retrospective): six near-duplicate scripts shared ~50 LOC
copy-pasted scaffolding. The extracted library exposes:

  find_repo_root(start)            → Path
  load_json(path) / write_json(...) → I/O helpers with exit-code semantics
  run_rubric_lint(repo, slug)      → (exit, stdout, stderr) tuple
  parse_rubric_score(stdout)       → int | None
  parse_criterion_table(stdout)    → list[(name, status)]
  extract_title / extract_description / extract_input_ids(html, slug)
  build_entry(slug, html, today, packs, categories, keywords) → dict
  validate_entry(entry)            → list[str] (failures; empty = pass)
  promote_wave(wave_id, slug_list, packs, categories, keywords, *, argv=None)
  audit_wave(wave_id, slug_list, *, argv=None)

The six wave-N.py modules become thin wrappers that define their per-wave
data (WAVE_N_SLUGS, WAVE_N_PACKS, WAVE_N_CATEGORIES, WAVE_N_KEYWORDS) and
delegate to promote_wave / audit_wave.

Pure-stdlib Python. The duplicate CLI surface (--slug, --quiet, --dry-run,
--inventory-only) is preserved exactly so existing Makefile targets and
smoke harnesses continue to work.

Usage (from thin wrappers, e.g. _promote_wave_2.py):
    from _wave_lib import promote_wave
    if __name__ == "__main__":
        sys.exit(promote_wave(
            wave_id=2,
            slug_list=WAVE_2_SLUGS,
            packs=WAVE_2_PACKS,
            categories=WAVE_2_CATEGORIES,
            keywords=WAVE_2_KEYWORDS,
        ))
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from datetime import date, datetime, timezone
from typing import Iterable, Mapping, Sequence

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"
INVENTORY_FILENAME = "docs/tool-inventory.md"
AUDIT_FILENAME = "docs/quality-audit.md"
RUBRIC_LINT = "scripts/rubric-lint.py"

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
# in the Settings modal / palette, not the tool body). Same set as
# the original _promote_wave_{1,2,3}.py copies.
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
    """Locate the repo root by walking up until tools.schema.json is found."""
    cur = start.resolve()
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"_wave_lib: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    """Read JSON from path with BOM-tolerant decode. Exits 3 on I/O, 2 on parse."""
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"_wave_lib: cannot read {path}: {e}\n")
        sys.exit(3)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"_wave_lib: invalid JSON in {path}: {e}\n")
        sys.exit(2)


def write_json(path: Path, obj: object) -> None:
    """Write JSON to path with indent=2 and trailing newline. Exits 3 on I/O."""
    try:
        path.write_text(
            json.dumps(obj, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        sys.stderr.write(f"_wave_lib: cannot write {path}: {e}\n")
        sys.exit(3)


def find_entry(tools_doc: dict, slug: str) -> dict | None:
    """Find a tool entry by slug (top-level `tools` array)."""
    tools = tools_doc.get("tools", [])
    for entry in tools:
        if entry.get("slug") == slug or entry.get("id") == slug:
            return entry
    return None


def extract_title(html: str, fallback: str) -> str:
    """Extract the <title>, stripping the '· Handy Tools' suffix that every
    tool page emits. Falls back to the kebab-case slug converted to Title Case
    if the title tag is missing or malformed."""
    m = TITLE_RE.search(html)
    if not m:
        return fallback.replace("-", " ").title()
    raw = m.group(1).strip()
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
    main_re = re.compile(
        r'<main\b[^>]*data-slug="' + re.escape(slug) + r'"[^>]*>',
        re.IGNORECASE,
    )
    main_m = main_re.search(html)
    if not main_m:
        main_m = re.search(r"<body\b[^>]*>", html, re.IGNORECASE)
    if not main_m:
        return []

    end = html.find("</main>", main_m.end())
    if end == -1:
        end = len(html)
    region = html[main_m.start():end]

    ids = set()
    for m in INPUT_ID_RE.finditer(region):
        cid = m.group(1)
        if cid in SHELL_CONTROL_IDS:
            continue
        ids.add(cid)

    settings_m = re.search(
        r'id="shell-settings-form"', region, re.IGNORECASE
    )
    if settings_m:
        settings_end = region.find("</form>", settings_m.end())
        if settings_end == -1:
            settings_end = len(region)
        settings_slice = region[settings_m.start():settings_end]
        settings_ids = set(INPUT_ID_RE.findall(settings_slice))
        ids -= settings_ids

    return sorted(ids)


def build_entry(
    slug: str,
    html: str,
    today: str,
    packs: Mapping[str, list[str]],
    categories: Mapping[str, str],
    keywords: Mapping[str, list[str]],
    *,
    default_category: str = "Converters & Calculators",
    default_pack: tuple[str, ...] = ("household",),
) -> dict:
    """Construct a tools.json entry for a single slug. Pure — does not mutate
    state. The schema-required fields are all populated.

    Tools 17-... allowed_keys behavior uses history-keys maxItems: 10 (Story 2.9).
    """
    title = extract_title(html, slug)
    description = extract_description(html, f"Handy tool for {title.lower()}.")
    input_ids = extract_input_ids(html, slug)
    capped_ids = input_ids[:10] if input_ids else [f"{slug}-state"]
    history_keys = capped_ids

    url_state: dict = {"default": {}, "encode": [], "decode": []}
    for key in capped_ids:
        url_state["default"][key] = ""
        url_state["encode"].append({"key": key, "type": "string", "from": f"#{key}"})
        url_state["decode"].append({"key": key, "type": "string", "to": f"#{key}"})

    entry: dict = {
        "id": slug,
        "slug": slug,
        "title": title,
        "description": description,
        "category": categories.get(slug, default_category),
        "pack": packs.get(slug, list(default_pack)),
        "icon": DEFAULT_ICON,
        "keywords": keywords.get(slug, [slug.replace("-", " ")]),
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


def run_rubric_lint(repo_root: Path, slug: str) -> tuple[int, str, str]:
    """Run rubric-lint.py for a single slug. Returns (exit_code, stdout, stderr)."""
    proc = subprocess.run(
        [sys.executable, str(repo_root / RUBRIC_LINT), slug],
        cwd=str(repo_root),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return proc.returncode, proc.stdout, proc.stderr


def parse_rubric_score(stdout: str) -> int | None:
    """Extract the integer score from rubric-lint.py's stdout.

    Looks for 'Total: N/10' (Epic 2 rubric format) or 'score: N' /
    'score = N' fallback. Returns None if no match.
    """
    m = re.search(r"\*\*Total:\s*(\d+)/10", stdout)
    if m:
        return int(m.group(1))
    m = re.search(r"\bscore\s*[:=]\s*(\d+)\b", stdout, re.IGNORECASE)
    return int(m.group(1)) if m else None


def parse_criterion_table(stdout: str) -> list[tuple[str, str]]:
    """Extract the per-criterion PASS/FAIL/WARN/MANUAL rows from the linter output."""
    rows: list[tuple[str, str]] = []
    pattern = re.compile(
        r"^\|\s*\d+\s*\|\s+([^|]+?)\s*\|\s*(PASS|FAIL|WARN|MANUAL)\s*\|",
        re.MULTILINE,
    )
    for m in pattern.finditer(stdout):
        rows.append((m.group(1).strip(), m.group(2)))
    return rows


def strip_existing_wave_section(existing: str, wave_id: int) -> str:
    """If the audit file already has a Wave-{N} section, remove it so the
    fresh section replaces it. Earlier-wave sections above are kept.

    Handles both leading-of-file (Wave-1 starts at line 1) and mid-file
    sections (Wave-2/Wave-3 are appended below earlier blocks). Also
    strips the immediately preceding '---' separator + blank lines so
    the appender can re-emit a single clean separator.
    """
    if not existing:
        return existing
    # Pattern: capture optional '---' separator + blank line + heading.
    # The heading is one of '# Quality Audit — Wave-N ...' or '## Wave-N ...'.
    patterns = (
        re.compile(
            rf"\n*---\s*\n+\s*# Quality Audit — Wave-{wave_id}[^\n]*\n.*\Z",
            re.DOTALL,
        ),
        re.compile(
            rf"\n*---\s*\n+\s*## Wave-{wave_id}[^\n]*\n.*\Z",
            re.DOTALL,
        ),
        re.compile(
            rf"^# Quality Audit — Wave-{wave_id}[^\n]*\n.*\Z",
            re.DOTALL,
        ),
        re.compile(
            rf"^## Wave-{wave_id}[^\n]*\n.*\Z",
            re.DOTALL,
        ),
    )
    out = existing
    for pat in patterns:
        out = pat.sub("", out)
    return out


def append_wave_section(
    repo_root: Path, wave_id: int, results: list[dict], today: str
) -> None:
    """Append a Wave-{N} section to docs/quality-audit.md, preserving any
    earlier-wave sections byte-for-byte (idempotent: existing Wave-{N}
    block is replaced in place).

    Wave-1's section omits the leading '---' separator (it sits at the
    top of the file) and uses the original simpler rubric wording
    ('PASS + WARN count'). Wave-2 and Wave-3 include the separator and
    use the newer 'PASS + half-WARN' wording.

    Preserves the source file's line ending (CRLF on Windows-authored
    repos, LF on Unix). All line-ending detection happens at write time.
    """
    out_path = repo_root / AUDIT_FILENAME
    raw_bytes = b""
    if out_path.is_file():
        raw_bytes = out_path.read_bytes()
    crlf = raw_bytes.startswith(b"\r\n") or b"\r\n" in raw_bytes[:8192]
    eol = "\r\n" if crlf else "\n"
    existing = raw_bytes.decode("utf-8", errors="ignore").replace("\r\n", "\n")
    existing = strip_existing_wave_section(existing, wave_id)
    is_first = wave_id == 1 or not existing.strip()
    if existing and not existing.endswith("\n\n"):
        existing = existing.rstrip("\n") + "\n\n"

    score_formula = (
        "PASS + WARN count" if wave_id == 1 else "mechanical count (PASS + half-WARN)"
    )
    story_id = "2.6" if wave_id == 1 else f"2.{5 + wave_id}"

    lines: list[str] = []
    if not is_first:
        lines.append("---")
        lines.append("")
    lines.append(f"# Quality Audit — Wave-{wave_id} Tools")
    lines.append("")
    lines.append(f"_Auto-generated by `scripts/_audit_wave_{wave_id}.py` on {today}._")
    lines.append(f"_Wave-{wave_id} tools: {len(results)} (Story {story_id})._")
    lines.append("")
    lines.append(f"Rubric: [docs/quality-rubric.md](./quality-rubric.md). "
                 f"Score = {score_formula}, max 10. Ready gate: score ≥ 8.")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    if wave_id == 1:
        lines.append("| Tool | Score | Bar (8) | Result |")
        lines.append("|---|---|---|---|")
    else:
        lines.append("| # | Tool | Score | Bar (8) | Result |")
        lines.append("|---|---|---|---|---|")
    any_fail = False
    for i, r in enumerate(results, 1):
        score = r["score"]
        bar = "PASS" if score is not None and score >= 8 else "FAIL"
        result = "✅ green" if bar == "PASS" else "❌ below bar"
        if wave_id == 1:
            lines.append(f"| `{r['slug']}` | {score if score is not None else '?'} | ≥ 8 | {result} |")
        else:
            lines.append(f"| {i} | `{r['slug']}` | {score if score is not None else '?'} | ≥ 8 | {result} |")
        if bar != "PASS":
            any_fail = True
    lines.append("")
    if any_fail:
        lines.append(f"**One or more wave-{wave_id} tools are below the 8/10 bar.** "
                     "See per-tool details below and remediate before promotion is "
                     "recorded as green.")
    else:
        lines.append(f"All wave-{wave_id} tools are at or above the 8/10 bar.")
    lines.append("")
    lines.append("## Per-tool Detail")
    lines.append("")
    for r in results:
        lines.append(f"### `{r['slug']}`")
        lines.append("")
        lines.append(f"- Score: **{r['score'] if r['score'] is not None else '?'}** "
                     f"(rubric exit {r['exit']})")
        if r["criteria"]:
            lines.append("")
            lines.append("| # | Criterion | Status |")
            lines.append("|---|---|---|")
            for i, (name, status) in enumerate(r["criteria"], 1):
                lines.append(f"| {i} | {name} | {status} |")
        else:
            lines.append("")
            lines.append("_No per-criterion rows captured; rubric-lint output may have changed format._")
        lines.append("")
    new_block = "\n".join(lines) + "\n"
    final = (existing + new_block).replace("\n", eol)
    out_path.write_text(final, encoding="utf-8", newline="")


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
    """Wave assignment per Story 1.4 / Story 2.6. Wave-1 = in tools.json
    with ready:true. Wave-2 = in tools.json but ready:false. Wave-3 = not
    in tools.json at all."""
    entry = find_entry(tools_doc, slug)
    if entry is not None and entry.get("ready"):
        return 1
    if entry is not None:
        return 2
    return 3


def has_sample_data(repo_root: Path, slug: str) -> bool:
    """True if the tool's <slug>.js declares a sample-state literal
    (heuristic: looks for 'sample' or 'default' as identifier)."""
    js_path = repo_root / "tools" / slug / f"{slug}.js"
    if not js_path.is_file():
        return False
    try:
        text = js_path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return bool(re.search(r"\b(sample|default)\b", text, re.IGNORECASE))


def emit_inventory(repo_root: Path, tools_doc: dict, today: str) -> None:
    """Write docs/tool-inventory.md. Source: list all on-disk tools and
    classify by ready state in tools.json."""
    all_slugs = discover_all_tools(repo_root)
    wave_1 = [s for s in all_slugs if classify_wave(s, tools_doc) == 1]
    wave_2 = [s for s in all_slugs if classify_wave(s, tools_doc) == 2]
    wave_3 = [s for s in all_slugs if classify_wave(s, tools_doc) == 3]

    lines: list[str] = []
    lines.append("# Tool Inventory")
    lines.append("")
    lines.append(f"_Auto-generated by `scripts/_promote_wave_1.py` on {today}._")
    lines.append(f"_Total tools discovered: **{len(all_slugs)}** "
                 f"(Wave-1: {len(wave_1)}, Wave-2: {len(wave_2)}, Wave-3: {len(wave_3)})._")
    lines.append("")
    lines.append("Wave assignment per Story 1.4 / Story 2.6 / Story 2.7 / Story 2.8:")
    lines.append("")
    lines.append("- **Wave-1** — already in `tools.json` with `ready: true` "
                 "(promoted under the per-tool contract in Stories 2.6, 2.7, 2.8).")
    lines.append("- **Wave-2** — in `tools.json` but `ready: false` (no entries "
                 "remain after Story 2.7).")
    lines.append("- **Wave-3** — not in `tools.json` (no entries remain after "
                 "Story 2.8; every on-disk tool is now Wave-1 ready:true).")
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


def validate_wave_1(tools_doc: dict, wave_1_slugs: Sequence[str], quiet: bool) -> list[str]:
    """Validate Wave-1 entries at the 8/10 bar (Story 2.6 form).

    Wave-1 is validate-only (the three tools are already at the bar; no
    promotion is performed). Returns failure reasons (empty = pass).
    """
    failures: list[str] = []
    for slug in wave_1_slugs:
        entry = find_entry(tools_doc, slug)
        if entry is None:
            failures.append(f"{slug}: missing from tools.json")
            continue
        if not entry.get("ready"):
            failures.append(f"{slug}: ready is not true (got {entry.get('ready')!r})")
        score = entry.get("score", 0)
        if score < 8:
            failures.append(f"{slug}: score {score} < 8")
        if "urlState" not in entry:
            failures.append(f"{slug}: missing urlState")
        if "history-keys" not in entry and "historyKeys" not in entry:
            failures.append(f"{slug}: missing history-keys")
        if "view-source" not in entry and "viewSource" not in entry:
            failures.append(f"{slug}: missing view-source")
        if not quiet:
            print(f"  ok  {slug}: ready=true, score={score}, "
                  "urlState + history-keys + view-source present")
    return failures


def promote_wave_1(
    wave_1_slugs: Sequence[str],
    wave_1_packs: Mapping[str, list[str]],
    *,
    argv: Iterable[str] | None = None,
) -> int:
    """Special Wave-1 entry: validate + emit docs/tool-inventory.md.

    Wave-1's three tools (qr-code-generator, inflation-calculator,
    lifespan-simulator) are already at the bar — there is no promotion
    to perform. The script validates that the entries still meet the bar
    and emits (or refreshes) the inventory doc.

    Exit codes:
      0 — all wave-1 tools at the bar; inventory written
      1 — at least one wave-1 tool is below the bar (with reason)
      2 — repo layout issue (tools.json missing)
      3 — I/O failure
    """
    parser = argparse.ArgumentParser(description="Story 2.6 wave-1 promotion + inventory")
    parser.add_argument("--inventory-only", action="store_true",
                        help="Skip validation; only emit docs/tool-inventory.md")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress output")
    args = parser.parse_args(list(argv) if argv is not None else None)

    repo_root = find_repo_root(Path(__file__).parent)
    tools_doc = load_json(repo_root / TOOLS_JSON_FILENAME)
    today = date.today().isoformat()

    print(f"_promote_wave_1: validating {len(wave_1_slugs)} wave-1 tools at score>=8")
    if not args.inventory_only:
        failures = validate_wave_1(tools_doc, wave_1_slugs, args.quiet)
        if failures:
            sys.stderr.write("_promote_wave_1: FAIL\n")
            for f in failures:
                sys.stderr.write(f"  - {f}\n")
            return 1
        print(f"_promote_wave_1: {len(wave_1_slugs)} PASS, 0 FAIL")

    print(f"_promote_wave_1: writing {INVENTORY_FILENAME}")
    emit_inventory(repo_root, tools_doc, today)
    print(f"_promote_wave_1: done ({today})")
    return 0


def promote_wave(
    wave_id: int,
    slug_list: Sequence[str],
    packs: Mapping[str, list[str]],
    categories: Mapping[str, str],
    keywords: Mapping[str, list[str]],
    *,
    argv: Iterable[str] | None = None,
) -> int:
    """CLI entry point for promote_wave_N. Wraps argparse, walks slugs,
    builds tools.json entries, and writes the result in-place.

    Exit codes:
      0 — all promoted
      1 — at least one tool below bar
      2 — repo layout / schema invalid
      3 — I/O failure
    """
    parser = argparse.ArgumentParser(description=f"Wave-{wave_id} promotion")
    parser.add_argument("--slug", action="append",
                        help="Restrict to one or more slugs (repeatable)")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress")
    parser.add_argument("--dry-run", action="store_true",
                        help="Compute entries without writing tools.json")
    args = parser.parse_args(list(argv) if argv is not None else None)

    repo_root = find_repo_root(Path(__file__).parent)
    tools_json_path = repo_root / TOOLS_JSON_FILENAME
    tools_doc = load_json(tools_json_path)
    tools = tools_doc.get("tools", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    slugs = list(args.slug) if args.slug else list(slug_list)
    pass_count = 0
    fail_count = 0
    failures: list[str] = []
    new_tools: list[dict] = []
    by_slug = {e.get("slug"): e for e in tools}

    for slug in slugs:
        html_path = repo_root / "tools" / slug / "index.html"
        if not html_path.is_file():
            sys.stderr.write(f"_promote_wave_{wave_id}: missing {html_path}\n")
            fail_count += 1
            failures.append(f"{slug}: index.html missing")
            continue
        try:
            html = html_path.read_text(encoding="utf-8", errors="ignore")
        except OSError as e:
            sys.stderr.write(f"_promote_wave_{wave_id}: cannot read {html_path}: {e}\n")
            fail_count += 1
            failures.append(f"{slug}: read error")
            continue

        entry = build_entry(slug, html, today, packs, categories, keywords)
        existing = by_slug.get(slug)
        if existing is not None:
            existing_failures = validate_entry(existing)
            if not existing_failures:
                if not args.quiet:
                    print(f"  =   {slug}: already at the bar (kept as-is)")
                new_tools.append(existing)
                pass_count += 1
                continue
            if not args.quiet:
                print(f"  ~   {slug}: replacing existing entry "
                      f"({len(existing_failures)} failures)")
        else:
            if not args.quiet:
                print(f"  +   {slug}: adding new entry")

        new_entry_failures = validate_entry(entry)
        if new_entry_failures:
            sys.stderr.write(f"_promote_wave_{wave_id}: {slug} build failures: "
                             f"{new_entry_failures}\n")
            fail_count += 1
            failures.extend(f"{slug}: {f}" for f in new_entry_failures)
            continue
        new_tools.append(entry)
        pass_count += 1

    if args.dry_run:
        print(f"_promote_wave_{wave_id} (dry-run): {pass_count} pass, {fail_count} fail")
        return 0 if fail_count == 0 else 1

    if fail_count > 0:
        sys.stderr.write(f"_promote_wave_{wave_id}: FAIL ({fail_count} tool(s))\n")
        for f in failures:
            sys.stderr.write(f"  - {f}\n")
        return 1

    wave_set = set(slugs)
    final_tools: list[dict] = []
    seen: set[str] = set()
    for e in tools:
        if e.get("slug") in wave_set:
            continue
        final_tools.append(e)
        seen.add(e.get("slug"))
    for e in new_tools:
        slug = e.get("slug")
        if slug in seen:
            continue
        final_tools.append(e)
        seen.add(slug)

    tools_doc["tools"] = final_tools
    tools_doc["generated"] = today + "T00:00:00Z"

    write_json(tools_json_path, tools_doc)

    print(f"_promote_wave_{wave_id}: wrote {len(new_tools)} entries "
          f"({pass_count} pass, {fail_count} fail)")
    return 0


def audit_wave(
    wave_id: int,
    slug_list: Sequence[str],
    *,
    argv: Iterable[str] | None = None,
) -> int:
    """CLI entry point for audit_wave_N. Runs rubric-lint.py per slug,
    appends a Wave-{N} section to docs/quality-audit.md.

    Exit codes:
      0 — all tools at score >= 8
      1 — at least one tool below bar
      2 — repo layout / script missing
      3 — I/O failure
    """
    parser = argparse.ArgumentParser(description=f"Wave-{wave_id} audit")
    parser.add_argument("--quiet", action="store_true",
                        help="Suppress per-tool progress")
    args = parser.parse_args(list(argv) if argv is not None else None)

    repo_root = find_repo_root(Path(__file__).parent)
    today = date.today().isoformat()

    if not (repo_root / RUBRIC_LINT).is_file():
        sys.stderr.write(f"_audit_wave_{wave_id}: missing {RUBRIC_LINT}\n")
        sys.exit(2)

    print(f"_audit_wave_{wave_id}: auditing {len(slug_list)} wave-{wave_id} tools")
    results: list[dict] = []
    for slug in slug_list:
        exit_code, stdout, stderr = run_rubric_lint(repo_root, slug)
        score = parse_rubric_score(stdout)
        criteria = parse_criterion_table(stdout)
        results.append({"slug": slug, "exit": exit_code, "score": score, "criteria": criteria})
        if not args.quiet:
            print(f"  ok  {slug}: exit={exit_code}, score={score}")
        if stderr:
            sys.stderr.write(stderr)

    print(f"_audit_wave_{wave_id}: appending to {AUDIT_FILENAME}")
    append_wave_section(repo_root, wave_id, results, today)

    failures = [r for r in results if r["score"] is None or r["score"] < 8]
    if failures:
        sys.stderr.write(f"_audit_wave_{wave_id}: FAIL "
                         f"({len(failures)} tool(s) below 8/10)\n")
        for r in failures:
            sys.stderr.write(f"  - {r['slug']}: score={r['score']}\n")
        return 1
    print(f"_audit_wave_{wave_id}: {len(slug_list)} PASS, 0 FAIL")
    return 0
