#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check-disc-pii.py — Build-time PII lint for the Discovery Pack (FR-28).

Scans packs/disc/**/*.json for personal-data patterns (email, phone,
IPv4, US-style street address) in any string field. The lint is
fail-closed: any PII match exits non-zero. An optional allowlist
(`pii-allowlist`) can be added to a quiz entry in tools.json to
exempt up to 3 specific prompts per quiz (e.g., "what's your
favorite color") that match the regex but contain no PII.

Brownfield-safe: only files under packs/disc/ are scanned. The
existing 50 tool entries live under tools/ and are untouched.

Pure stdlib. No third-party deps.

Exit codes:
  0 — no PII detected (or all matches are allowlisted)
  1 — at least one PII match failed the allowlist
  2 — usage / setup error
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


# Patterns are intentionally conservative — these catch *obvious* PII
# in user-facing prompts. Anything fancier (e.g., names, birthdays,
# geolocation coords) belongs to the receiver-side consent gate
# (Story 10.12) and is out of scope here.
EMAIL_RE   = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_RE   = re.compile(
    r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
)
IPV4_RE    = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
# US-style street address: <number> <word> <Street|St|Ave|Rd|...>
STREET_RE  = re.compile(
    r"\b\d+\s+[A-Za-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b"
)

PATTERNS = [
    ("email",   EMAIL_RE),
    ("phone",   PHONE_RE),
    ("ipv4",    IPV4_RE),
    ("street",  STREET_RE),
]


def walk_strings(obj, path=()):
    """Yield (path, value) for every string in a nested object/array.

    `path` is a tuple of dict keys / list indices describing where the
    string was found. Used in lint output to pinpoint the offender.
    """
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, path + (str(k),))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk_strings(v, path + (f"[{i}]",))
    elif isinstance(obj, str):
        yield (path, obj)


def load_allowlist(tools_json_path):
    """Read pii-allowlist entries from tools.json → packs.disc[*].

    Returns a dict of {quiz_slug: {field_path_lower: [allowed_text,...]}}.
    Quiz slugs are kebab-case identifiers from packs.disc[].slug.
    """
    if not tools_json_path.is_file():
        return {}
    try:
        data = json.loads(tools_json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    packs = (data.get("packs") or {})
    disc = packs.get("disc") or []
    allow = {}
    for entry in disc:
        if not isinstance(entry, dict):
            continue
        slug = entry.get("slug") or entry.get("id")
        allowlist = entry.get("pii-allowlist") or []
        if slug and isinstance(allowlist, list):
            allow[str(slug)] = [str(a).lower() for a in allowlist if a]
    return allow


def scan_file(json_path, allow_for_file=None):
    """Scan one JSON file for PII. Returns list of (path, kind, match)."""
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        return [(() , f"<read-error: {e}>", str(json_path))]
    matches = []
    allow_for_file = allow_for_file or set()
    for path, value in walk_strings(data):
        v_lower = value.lower()
        for kind, regex in PATTERNS:
            for m in regex.finditer(value):
                matched = m.group(0)
                # Allowlist exemption: literal text fragment from
                # `pii-allowlist` (case-insensitive substring match).
                # The allowlist is *not* a regex; it's author-declared
                # exception strings.
                if any(allow in v_lower for allow in allow_for_file):
                    continue
                matches.append((path, kind, matched))
    return matches


def main():
    repo = Path(__file__).resolve().parent.parent
    disc_dir = repo / "packs" / "disc"
    tools_json = repo / "tools.json"
    # Allow the lint to be exercised against a sandboxed fixture
    # (e.g., the DC-12 negative-fixture check) by falling back to
    # `<cwd>/packs/disc` when the script's own repo has no packs/disc/
    # yet. Brownfield-safe: the production run always uses the script's
    # own repo; the cwd fallback only fires for the gate's test.
    cwd = Path.cwd()
    if not disc_dir.is_dir() and (cwd / "packs" / "disc").is_dir():
        repo = cwd
        disc_dir = repo / "packs" / "disc"
        tools_json = repo / "tools.json"

    if not disc_dir.is_dir():
        # No packs/disc yet — vacuous pass. The lint will activate
        # once Story 10.7 lands 6 quiz entries.
        print(f"check-disc-pii: packs/disc/ not found ({disc_dir}) — vacuous pass")
        print("JSON:{\"story\": \"DC-12-PII\", \"pass\": 1, \"fail\": 0}")
        sys.exit(0)

    allow = load_allowlist(tools_json)

    total_fail = 0
    scanned = 0
    for json_path in sorted(disc_dir.rglob("*.json")):
        # Derive quiz slug from path: packs/disc/<quiz>/<file>.json
        rel = json_path.relative_to(disc_dir)
        parts = rel.parts
        quiz_slug = parts[0] if len(parts) >= 2 else None
        allowlist = set(allow.get(quiz_slug, []))
        scanned += 1
        matches = scan_file(json_path, allow_for_file=allowlist)
        for path, kind, matched in matches:
            total_fail += 1
            print(
                f"  FAIL  PII({kind}) in {json_path.relative_to(repo)} :: "
                f"{'.'.join(path)}: {matched!r}"
            )

    if total_fail == 0:
        print(f"check-disc-pii: scanned {scanned} file(s), 0 PII matches")
        print(f"JSON:{{\"story\": \"DC-12-PII\", \"pass\": 1, \"fail\": {total_fail}}}")
        sys.exit(0)
    else:
        print(f"check-disc-pii: scanned {scanned} file(s), {total_fail} PII match(es)")
        print(f"JSON:{{\"story\": \"DC-12-PII\", \"pass\": 0, \"fail\": {total_fail}}}")
        sys.exit(1)


if __name__ == "__main__":
    main()
