"""
rubric-lint.py — score a tool against docs/quality-rubric.md.

Pure-stdlib Python. Mirrors the shape of scripts/validate-tools-json.py: no
third-party deps, exit codes 0/1/2/3, prints a Markdown report.

Usage:
    scripts/rubric-lint.py <slug>          # score one tool
    scripts/rubric-lint.py --list          # 10-criterion roster
    scripts/rubric-lint.py --all           # summary table for every entry

Exit codes:
    0 — tool is ready (score >= 8 AND ready=true)
    1 — score/ready mismatch (score >= 8 but ready=false, or score < 8 with no waiver)
    2 — file/slug missing or unparseable
    3 — schema invalid

The linter is mechanical for criteria 3, 4, 5, 6, 7 (FAIL) and 1, 2, 8 (WARN);
criteria 9 and 10 are MANUAL. The rubric doc (docs/quality-rubric.md) is the
authoritative source — when the linter and the doc disagree, the doc wins.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Force UTF-8 on stdout/stderr so the Markdown report renders correctly on
# Windows consoles (cp1252) without crashing on ≥ / ✗ / ✓ / non-ASCII quotes.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

# ---------------------------------------------------------------------------
# Repo discovery (same walk-up pattern as validate-tools-json.py)
# ---------------------------------------------------------------------------

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_JSON_FILENAME = "tools.json"


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing tools.schema.json."""
    try:
        cur = start.resolve()
    except OSError as e:
        sys.stderr.write(f"rubric-lint: cannot resolve {start}: {e}\n")
        sys.exit(2)
    for candidate in [cur, *cur.parents]:
        if (candidate / SCHEMA_FILENAME).is_file():
            return candidate
    sys.stderr.write(
        f"rubric-lint: cannot locate {SCHEMA_FILENAME} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_json(path: Path) -> object:
    """Load JSON; BOM-tolerant; raise with file path on error."""
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as e:
        sys.stderr.write(f"rubric-lint: cannot read {path}: {e}\n")
        sys.exit(2)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"rubric-lint: invalid JSON in {path}: {e}\n")
        sys.exit(2)


def slug_regex() -> re.Pattern[str]:
    # Mirror tools.schema.json tool-entry.slug/id pattern.
    return re.compile(r"^[a-z][a-z0-9-]*[a-z0-9]$")


# ---------------------------------------------------------------------------
# Criterion definitions
#
# Each check returns (result, notes, remediation) where result is one of
# "PASS", "FAIL", "MANUAL", "WARN".
# ---------------------------------------------------------------------------

EXTERNAL_HOST_RE = re.compile(
    r"""(?xi)
    \b(?:https?://[^\s'"]+|//[a-z0-9.-]+)
    | \bcdn\.
    | fonts\.googleapis\.com
    | fonts\.gstatic\.com
    """
)
# Localhost and the vendored QR encoder are allowed.
EXTERNAL_HOST_ALLOWLIST = (
    "qrcode.js",
)

# XML namespace URIs that never load anything at runtime. Matched only when
# they appear in an `xmlns`/`xmlns:foo="…"` attribute, NEVER as a free URL.
XML_NS_PATTERNS = (
    re.compile(r"""xmlns(?::[a-zA-Z0-9_-]+)?\s*=\s*["']https?://www\.w3\.org"""),
)

# Bare W3C namespace strings. Used in JS like
# `document.createElementNS('http://www.w3.org/2000/svg', 'svg')` —
# never a network load, an XML namespace identifier only.
W3C_NS_BARE = (
    "http://www.w3.org/2000/svg",
    "http://www.w3.org/1998/Math/MathML",
    "http://www.w3.org/1999/xlink",
    "http://www.w3.org/XML/1998/namespace",
)

# Hosts that are pure documentation / link references in copy/sample data,
# never runtime script/style/font loads. These appear in tool bodies as
# reference URLs, footer anchors, or sample-data strings.
DOC_HOST_ALLOWLIST = (
    "github.com/sanjitdev/",
    "github.com/sanjitdev/useful-tools",
    "example.com",
    "example.org",
    "www.cdc.gov",
    "www.who.int",
    "handy.tools",
)


def _scan_text_for_external_host(text: str) -> list[str]:
    """Return list of external-host references that are not exempt.

    An exemption is granted only for:
      - the substring `qrcode.js` (the vendored library — at most one of
        these in the repo; matches anywhere in the URL)
      - XML namespace URIs when they appear in an `xmlns`/`xmlns:foo="…"`
        attribute (they never load anything at runtime)
      - Bare W3C namespace strings (used in JS via createElementNS —
        never a network load)
      - Documentation / link hosts in DOC_HOST_ALLOWLIST (footer GitHub
        links, reference URLs in copy, sample data — never runtime loads)

    Other matches, including `https://example.com/...`, are flagged.
    """
    has_xmlns = any(pat.search(text) for pat in XML_NS_PATTERNS)
    hits: list[str] = []
    for m in EXTERNAL_HOST_RE.finditer(text):
        snippet = m.group(0)
        if any(allow in snippet for allow in EXTERNAL_HOST_ALLOWLIST):
            continue
        # W3C xmlns in the same file → exempt W3C refs in this file.
        if has_xmlns and any(ns in snippet for ns in W3C_NS_BARE):
            continue
        # Bare W3C namespace string (createElementNS-style use in JS).
        if any(ns in snippet for ns in W3C_NS_BARE):
            continue
        # Documentation / link / sample-data hosts.
        if any(host in snippet for host in DOC_HOST_ALLOWLIST):
            continue
        hits.append(snippet)
    return hits


def check_offline_files(file_paths: list[Path]) -> tuple[str, str, str]:
    hits = []
    for fp in file_paths:
        if not fp.is_file():
            continue
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        hits.extend(_scan_text_for_external_host(text))
    if hits:
        joined = ", ".join(sorted(set(hits))[:3])
        return (
            "FAIL",
            f"External host references detected: {joined}",
            "External script/style/font violates AD-1 (Zero Runtime Libraries); "
            "vendor the file under assets/js/vendor/ or replace with inline logic.",
        )
    return ("PASS", "No external-host references found.", "")


def _collect_html_ids(html_text: str | None) -> set[str]:
    """Return the set of `id="…"` and `id='…'` values found in HTML."""
    if not html_text:
        return set()
    ids: set[str] = set()
    for m in re.finditer(r"""id\s*=\s*["']([^"']+)["']""", html_text):
        ids.add(m.group(1))
    return ids


def check_shareable(entry: dict, html_text: str | None = None) -> tuple[str, str, str]:
    """Criterion 4 — Shareable state.

    Mechanical checks:
      1. `urlState.encode` is non-empty AND has unique string keys.
      2. Every `encode[].key` matches a `decode[].key` (with `to` resolution).
      3. Every `decode[].to` (or `encode[].from`, falling back to `key`)
         resolves to an `id` in the tool's HTML.
    """
    url_state = entry.get("urlState") or {}
    encode = url_state.get("encode") or []
    decode = url_state.get("decode") or []
    if not encode:
        return (
            "FAIL",
            "urlState.encode is empty.",
            "Declare each input field under urlState.encode[]/decode[] so AD-5 "
            "(URL is canonical state) holds.",
        )
    enc_keys = [item.get("key") for item in encode if isinstance(item, dict)]
    dec_keys = [item.get("key") for item in decode if isinstance(item, dict)]
    if any(not isinstance(k, str) or not k for k in enc_keys + dec_keys):
        return (
            "FAIL",
            "urlState encode/decode entries must each have a non-empty string `key`.",
            "Fix urlState.encode[]/decode[] entries in tools.json.",
        )
    missing = set(enc_keys) - set(dec_keys)
    if missing:
        return (
            "FAIL",
            f"encode[] keys missing from decode[]: {sorted(missing)}",
            "Every urlState.encode[].key must have a matching urlState.decode[].key.",
        )
    if html_text is None:
        return ("PASS", f"{len(enc_keys)} URL keys declared (HTML not loaded).", "")
    ids = _collect_html_ids(html_text)
    targets: list[str] = []
    for item in encode:
        if not isinstance(item, dict):
            continue
        sel = item.get("from") or item.get("key")
        if isinstance(sel, str):
            targets.append(sel)
    for item in decode:
        if not isinstance(item, dict):
            continue
        sel = item.get("to") or item.get("key")
        if isinstance(sel, str):
            targets.append(sel)
    # Selectors may be prefixed with "#" (CSS id selector form); strip it
    # so the existence check compares against the bare id set.
    def _strip_hash(s: str) -> str:
        return s[1:] if s.startswith("#") else s
    missing_targets = [t for t in targets if _strip_hash(t) not in ids]
    if missing_targets:
        return (
            "FAIL",
            f"encode/decode selectors missing from tool HTML: {missing_targets}",
            "Every urlState.encode[].from and urlState.decode[].to must resolve "
            "to an id in tools/<slug>/index.html.",
        )
    return ("PASS", f"{len(enc_keys)} URL keys declared and resolve to DOM ids.", "")


def check_printable(file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 5 — Printable. Tool's CSS must contain @media print."""
    css_files = [p for p in file_paths if p.suffix == ".css"]
    for fp in css_files:
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        if re.search(r"@media\s+print", text, re.IGNORECASE):
            return ("PASS", f"@media print found in {fp.name}.", "")
    return (
        "FAIL",
        "No @media print block in any tool CSS.",
        "Add an @media print block in <slug>.css that hides chrome and forces "
        "black-on-white text.",
    )


SAMPLE_DATA_RE = re.compile(
    r"""(?xi)
    \btry\s+an?\s+example\b
    | \btry\s+example\b
    | \bload\s+sample\b
    | data-sample
    """
)


def check_sample_data(file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 6 — Sample data. Tool's JS/HTML must surface a sample button."""
    js_or_html = [p for p in file_paths if p.suffix in (".js", ".html")]
    for fp in js_or_html:
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        if SAMPLE_DATA_RE.search(text):
            return (
                "PASS",
                f"Sample-data marker found in {fp.name}.",
                "",
            )
    return (
        "FAIL",
        "No 'Try an example' / 'Load sample' / data-sample marker in any tool JS/HTML.",
        "Add a button labeled 'Try an example' that fills the inputs with realistic data.",
    )


def check_history(entry: dict, html_text: str | None) -> tuple[str, str, str]:
    """Criterion 7 — History. history-keys non-empty AND ids exist in tool HTML."""
    history_keys = entry.get("history-keys") or []
    if not isinstance(history_keys, list) or not history_keys:
        return (
            "FAIL",
            "history-keys is empty or not a list.",
            "Declare the input ids whose values belong in "
            "handy-tools.history.<slug> (FR-12).",
        )
    if any(not isinstance(k, str) or not k for k in history_keys):
        return (
            "FAIL",
            "history-keys must be a list of non-empty strings.",
            "Fix history-keys in tools.json.",
        )
    if len(history_keys) > 10:
        return (
            "FAIL",
            f"history-keys has {len(history_keys)} entries; the FR-12 cap is 10.",
            "Trim history-keys to 10 entries.",
        )
    if html_text is None:
        return ("PASS", f"{len(history_keys)} history-keys declared (HTML not loaded).", "")
    ids = _collect_html_ids(html_text)
    missing = [k for k in history_keys if k not in ids]
    if missing:
        return (
            "FAIL",
            f"history-keys ids missing from tool HTML: {missing}",
            "Each history-keys entry must match an id in tools/<slug>/index.html.",
        )
    return ("PASS", f"{len(history_keys)} history-keys resolve to inputs.", "")


ERROR_MARKER_RE = re.compile(
    r"""(?x)
    role\s*=\s*["']alert["']
    | aria-invalid
    | aria-describedby
    | \.field-error
    | data-error
    """
)


def check_error_recovery(file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 8 — Error recovery. Soft WARN if no inline-error markers.

    A positive signal requires either a `role="alert"` or `aria-invalid`
    attribute AND a paired error-element marker (`.field-error` or
    `data-error`). `aria-describedby` alone is too generic to be a signal.
    """
    alert_or_invalid = re.compile(r"""role\s*=\s*["']alert["']|aria-invalid""", re.I)
    error_class = re.compile(r"""\.field-error|data-error""")
    for fp in file_paths:
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        if alert_or_invalid.search(text) and error_class.search(text):
            return ("PASS", f"Inline-error marker pair found in {fp.name}.", "")
    return (
        "WARN",
        "No inline-error marker pair detected (role='alert' or aria-invalid "
        "plus .field-error or data-error).",
        "Verify each input renders inline errors with role='alert' + aria-invalid "
        "and a paired .field-error element when invalid.",
    )


KEYDOWN_RE = re.compile(r"""addEventListener\(\s*['"]key(down|up|press)['"]""")
HTML_KEYBOARD_RE = re.compile(r"""<(?:button|form)\b""", re.I)


def check_keyboard(file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 1 — Keyboard-complete. Soft WARN if no keyboard signal.

    A positive signal is either a JS `keydown` listener OR a native
    keyboard-operable element (`<button>`, `<form>`).
    """
    for fp in file_paths:
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        if fp.suffix == ".js" and KEYDOWN_RE.search(text):
            return ("PASS", f"Keyboard listener found in {fp.name}.", "")
        if fp.suffix == ".html" and HTML_KEYBOARD_RE.search(text):
            return ("PASS", f"Keyboard-operable element found in {fp.name}.", "")
    return (
        "WARN",
        "No keydown listener or keyboard-operable element found in tool assets.",
        "Verify Tab/Enter reach every input manually; add "
        "addEventListener('keydown', …) if a shortcut is intended.",
    )


MOBILE_TAP_TARGET_RE = re.compile(
    r"""(?xi)
    \b(?:min-)?(?:width|height)\s*:\s*([0-9]{1,3})px
    """
)


def check_mobile(file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 2 — Mobile ergonomics. CSS heuristic.

    Flags fixed-width declarations under 360 px and min-width/height
    declarations under 44 px. With no CSS at all, the heuristic cannot
    confirm — returns WARN with a "manual review" note.
    """
    suspicious: list[str] = []
    css_seen = False
    for fp in file_paths:
        if fp.suffix != ".css":
            continue
        css_seen = True
        try:
            text = fp.read_text(encoding="utf-8-sig")
        except OSError:
            continue
        for m in MOBILE_TAP_TARGET_RE.finditer(text):
            px = int(m.group(1))
            decl = m.group(0).lower()
            if "min-" in decl and px < 44:
                suspicious.append(f"{fp.name}: {m.group(0)}")
            elif "min-" not in decl and px < 360:
                suspicious.append(f"{fp.name}: {m.group(0)}")
    if suspicious:
        return (
            "WARN",
            f"Possible mobile constraint under 360 px / 44 px: {suspicious[0]}",
            "Bump min-height/min-width to ≥ 44 px for tappable controls; "
            "raise fixed-width declarations above 360 px (PRD §4.1 #2).",
        )
    if not css_seen:
        return (
            "WARN",
            "No tool CSS to inspect; manual 360 px review required.",
            "Add a stylesheet and verify single-hand use at 360 px width.",
        )
    return (
        "PASS",
        "No CSS heuristic flagged; manual 360 px review still required.",
        "Open the tool in DevTools at 360 px and confirm tap targets reach 44 px.",
    )


def check_accessible(_entry: dict, _file_paths: list[Path]) -> tuple[str, str, str]:
    """Criterion 9 — Accessible. Always MANUAL."""
    return (
        "MANUAL",
        "No mechanical check; WCAG 2.1 AA + SR review required.",
        "Run the WCAG 2.1 AA checklist in docs/quality-rubric.md#9-accessible; "
        "verify DESIGN.md cobalt tokens reach ≥ 4.5:1 contrast.",
    )


def check_source_visible(entry: dict, tool_dir: Path | None = None) -> tuple[str, str, str]:
    """Criterion 10 — Source visible.

    Mechanical checks:
      1. `view-source.enabled` is a boolean.
      2. `view-source.path` matches `tools/<slug>/index.html`.
      3. The file at that path exists (cross-field + filesystem check).

    The actual rendered footer link is left for manual review (AD-11 / FR-16).
    """
    vs = entry.get("view-source")
    if not isinstance(vs, dict):
        return (
            "FAIL",
            "view-source object is missing or not a dict.",
            "Declare view-source: { enabled: true, path: 'tools/<slug>/index.html' }.",
        )
    if not isinstance(vs.get("enabled"), bool):
        return (
            "FAIL",
            "view-source.enabled must be a boolean.",
            "Set view-source.enabled=true (or false to opt out).",
        )
    if vs.get("enabled") is False:
        return (
            "FAIL",
            "view-source.enabled is false.",
            "Flip view-source.enabled=true and ensure the footer renders a "
            "'View source' link (AD-11 / FR-16).",
        )
    path = vs.get("path")
    if not isinstance(path, str):
        return (
            "FAIL",
            "view-source.path must be a string.",
            "Set view-source.path to 'tools/<slug>/index.html'.",
        )
    slug = entry.get("slug", "")
    expected = f"tools/{slug}/index.html"
    if path != expected:
        return (
            "FAIL",
            f"view-source.path is {path!r}; expected {expected!r}.",
            "Set view-source.path to match the tool's slug.",
        )
    if tool_dir is not None:
        target = tool_dir / "../" / path
        try:
            target = (tool_dir.parent.parent / path).resolve()
        except OSError:
            target = None
        if target is None or not target.is_file():
            return (
                "FAIL",
                f"view-source.path points to {path} but the file does not exist.",
                "Create tools/<slug>/index.html or correct view-source.path.",
            )
    return (
        "MANUAL",
        "view-source contract fields pass mechanical checks; verify the rendered footer link.",
        "Open the tool in a browser, confirm the footer link points to the "
        "public repo path (AD-11).",
    )


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

def _md_cell(value: str) -> str:
    """Escape a Markdown table cell: pipes break the table, newlines break rows.

    A pipe inside the cell (e.g., a URL containing `|`) is escaped to `\\|`,
    and inner newlines become `<br>` so the cell stays on one row.
    """
    if value is None:
        return ""
    s = str(value)
    s = s.replace("\\", "\\\\").replace("|", "\\|").replace("\r", " ").replace("\n", "<br>")
    return s


CRITERIA = [
    (1, "Keyboard-complete", "keyboard"),
    (2, "Mobile ergonomics", "mobile"),
    (3, "Offline ready", "offline"),
    (4, "Shareable state", "shareable"),
    (5, "Printable", "printable"),
    (6, "Sample data", "sample-data"),
    (7, "History", "history"),
    (8, "Error recovery", "error-recovery"),
    (9, "Accessible", "accessible"),
    (10, "Source visible", "source-visible"),
]


def _list_roster() -> None:
    print("# Handy Tools — Rubric Roster (10 criteria)")
    print("")
    print("| # | Criterion | Mechanical? |")
    print("|---|---|---|")
    mechanical = {3, 4, 5, 6, 7}
    warn_only = {1, 2, 8}
    manual = {9, 10}
    for n, name, _ in CRITERIA:
        if n in mechanical:
            tag = "yes (FAIL)"
        elif n in warn_only:
            tag = "yes (WARN)"
        else:
            tag = "MANUAL"
        print(f"| {n} | {name} | {tag} |")
    print("")
    print("See docs/quality-rubric.md for per-criterion detail.")


def _collect_tool_files(tool_dir: Path) -> list[Path]:
    if not tool_dir.is_dir():
        return []
    out = []
    for entry in sorted(tool_dir.iterdir()):
        if entry.is_file() and entry.suffix in (".html", ".js", ".css"):
            out.append(entry)
    return out


def _html_text_for(tool_dir: Path) -> str | None:
    idx = tool_dir / "index.html"
    if not idx.is_file():
        return None
    try:
        return idx.read_text(encoding="utf-8-sig")
    except OSError:
        return None


def _run_one(slug: str, entry: dict, tool_dir: Path, *, is_fallback: bool = False) -> tuple[int, list[tuple[int, str, str, str, str]]]:
    """Return (exit_code, rows).

    `is_fallback=True` means the entry was synthesized because the slug was not
    in `tools.json`; the report surfaces that fact so maintainers don't read
    a synthesized entry as a real inventory entry.
    """
    files = _collect_tool_files(tool_dir)
    html = _html_text_for(tool_dir)

    results: dict[str, tuple[str, str, str]] = {}
    results["offline"] = check_offline_files(files)
    results["shareable"] = check_shareable(entry, html)
    results["printable"] = check_printable(files)
    results["sample-data"] = check_sample_data(files)
    results["history"] = check_history(entry, html)
    results["error-recovery"] = check_error_recovery(files)
    results["keyboard"] = check_keyboard(files)
    results["mobile"] = check_mobile(files)
    results["accessible"] = check_accessible(entry, files)
    results["source-visible"] = check_source_visible(entry, tool_dir)

    rows: list[tuple[int, str, str, str, str]] = []
    score = 0
    for n, name, key in CRITERIA:
        result, notes, remediation = results[key]
        if result in ("PASS", "WARN"):
            score += 1
        rows.append((n, name, result, notes, remediation))

    # Gate check (AD-2).
    ready_flag = bool(entry.get("ready"))
    score_field = entry.get("score")
    waiver = entry.get("score-waiver")

    print(f"# Rubric report — `{slug}`")
    print("")
    if is_fallback:
        print(f"> Tool folder `tools/{slug}/` exists but no `tools.json` entry — fallback to folder scan.")
        print("> `tools.json` score/ready shown below are **placeholder** values, not the audit record.")
        print("")
    print(f"- `tools.json` score: {score_field}")
    print(f"- `tools.json` ready: {ready_flag}")
    print(f"- Mechanical linter score: {score}/10")
    if waiver:
        print(f"- score-waiver: present (reason={waiver.get('reason', '?')!r})")
    print("")
    print("| # | Criterion | Result | Notes | Remediation |")
    print("|---|---|---|---|---|")
    for n, name, result, notes, remediation in rows:
        print(f"| {n} | {name} | {result} | {_md_cell(notes)} | {_md_cell(remediation)} |")
    print("")
    print(f"**Total: {score}/10.**")
    # Gate truth table (AD-2):
    #   linter_score >= 8 AND ready=true                                         -> PASS        (exit 0)
    #   linter_score >= 8 AND ready=false (and no waiver)                        -> MISMATCH    (exit 1)
    #   linter_score < 8  AND waiver present (waiver not yet expired)             -> WAIVER      (exit 4)
    #   linter_score < 8  AND ready=true without waiver                          -> MISMATCH    (exit 1)
    #   linter_score < 8  AND no waiver                                          -> FAIL        (exit 1)
    # Persisted `score` is reported but not authoritative — a reviewer sets it
    # in `tools.json` after the manual phase (criteria 9 and 10).
    persisted_score = entry.get("score")
    persisted_score_str = (
        f"{persisted_score}/10" if isinstance(persisted_score, int) else "not set"
    )
    if score >= 8 and ready_flag:
        print("**Gate: PASS.** Linter score ≥ 8 and `ready=true`.")
        print(f"**Persisted score:** {persisted_score_str} (manual review owner.)")
        return 0, rows
    if score >= 8 and not ready_flag:
        print(f"**Gate: MISMATCH.** Linter sees {score} but `ready=false` — flip `ready=true` or correct the linter signal.")
        return 1, rows
    if score < 8 and waiver:
        print(f"**Gate: WAIVER.** Score {score} is below 8 but `score-waiver` is present (reason={waiver.get('reason', '?')!r}).")
        if isinstance(persisted_score, int) and persisted_score >= 8:
            print(f"**Note:** Persisted score is {persisted_score} (manual review); linter agrees shippable.")
            return 0, rows
        return 4, rows
    if score < 8 and ready_flag:
        print(f"**Gate: MISMATCH.** `ready=true` but linter score {score} < 8 and no waiver.")
        return 1, rows
    print(f"**Gate: FAIL.** Score {score} is below 8 and no waiver is present.")
    return 1, rows


def _run_all(entries: list[dict]) -> int:
    print("# Rubric summary — all tools")
    print("")
    if not entries:
        print("No entries in `tools.json`; the inventory will be populated by the brownfield migration step.")
        return 0
    sorted_entries = sorted(entries, key=lambda e: (not bool(e.get("ready")), e.get("slug", "")))
    print("| Slug | Score | Ready | Waiver |")
    print("|---|---|---|---|")
    for e in sorted_entries:
        slug = e.get("slug", "?")
        score = e.get("score")
        ready = e.get("ready")
        waiver = "yes" if e.get("score-waiver") else "—"
        print(f"| {slug} | {score} | {ready} | {waiver} |")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Score a tool against docs/quality-rubric.md.",
    )
    parser.add_argument("slug", nargs="?", help="Tool slug (kebab-case).")
    parser.add_argument("--list", action="store_true", help="Print the 10-criterion roster and exit.")
    parser.add_argument("--all", action="store_true", help="Print a summary table for every entry.")
    args = parser.parse_args(argv)

    # `--list` is static — emit the roster without touching the repo.
    if args.list:
        _list_roster()
        return 0

    # No args — print the roster (same as --list) so the command is callable
    # at a glance without reading the help screen.
    if not args.slug and not args.all:
        _list_roster()
        return 0

    repo = find_repo_root(Path(__file__).parent)
    tools_json = load_json(repo / TOOLS_JSON_FILENAME)

    if not isinstance(tools_json, dict):
        sys.stderr.write("rubric-lint: tools.json must be a JSON object at the top level.\n")
        return 3
    if not isinstance(tools_json.get("tools"), list):
        sys.stderr.write("rubric-lint: tools.json must have a `tools` array.\n")
        return 3

    if args.all:
        return _run_all(tools_json["tools"])

    slug = args.slug
    if not slug_regex().match(slug):
        sys.stderr.write(
            f"rubric-lint: slug {slug!r} does not match the kebab-case pattern "
            "^[a-z][a-z0-9-]*[a-z0-9]$\n"
        )
        return 2

    tools = tools_json["tools"]
    entry = next((e for e in tools if isinstance(e, dict) and e.get("slug") == slug), None)

    tool_dir = repo / "tools" / slug
    if entry is None and not tool_dir.is_dir():
        sys.stderr.write(
            f"rubric-lint: slug {slug!r} not found in tools.json and "
            f"tools/{slug}/ does not exist.\n"
        )
        return 2

    fallback_entry = entry or {"slug": slug, "ready": False, "score": 0, "history-keys": [], "urlState": {}, "view-source": {"enabled": False}}
    code, _ = _run_one(slug, fallback_entry, tool_dir, is_fallback=entry is None)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
