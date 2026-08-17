#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-0-schema.py — AC for DC-0 (Schema additions).

Verifies tools.schema.json was updated to support `packs[]` with the
Discovery Pack module system. Target: 13 PASS after DC-0 merges.

Run: `make dc-0-schema` or `python scripts/dc/dc-0-schema.py`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, repo_root


def load_schema():
    return json.loads(
        (repo_root() / "tools.schema.json").read_text(encoding="utf-8")
    )


def has(d, dotted):
    """Return the value at a dotted path, or None if missing."""
    cur = d
    for k in dotted.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return None
        cur = cur[k]
    return cur


def main():
    print("DC-0 — Schema additions (packs[] + pack-entry + module-defs)")

    # 1. schema parses as valid JSON
    try:
        s = load_schema()
        check(isinstance(s, dict), "tools.schema.json parses as valid JSON")
    except Exception as e:
        check(False, f"tools.schema.json parses as valid JSON ({e})")
        return exit_with_summary("DC-0")

    # 2. top-level `properties.packs` exists with additionalProperties: { $ref: '#/definitions/pack-entry' }
    props_packs = has(s, "properties.packs")
    check(
        isinstance(props_packs, dict)
        and props_packs.get("additionalProperties", {}).get("$ref")
        == "#/definitions/pack-entry",
        "properties.packs.additionalProperties.$ref == '#/definitions/pack-entry'",
    )

    # 3. definitions.pack-entry requires slug, title, loader, entries
    pe = has(s, "definitions.pack-entry")
    required = (pe or {}).get("required", [])
    check(
        all(k in required for k in ("slug", "title", "loader", "entries")),
        "definitions.pack-entry requires slug, title, loader, entries",
    )

    # 4. definitions.quiz-entry requires slug, title, category, data, modules
    qe = has(s, "definitions.quiz-entry")
    required = (qe or {}).get("required", [])
    check(
        all(k in required for k in ("slug", "title", "category", "data", "modules")),
        "definitions.quiz-entry requires slug, title, category, data, modules",
    )

    # 5. definitions.module-def has closed enum on kind: [scoring, results, challenge, catalog]
    md = has(s, "definitions.module-def")
    kind_enum = (
        ((md or {}).get("properties") or {}).get("kind") or {}
    ).get("enum", [])
    check(
        set(kind_enum) == {"scoring", "results", "challenge", "catalog"},
        "definitions.module-def.kind enum == [scoring, results, challenge, catalog]",
    )

    # 6. definitions.module-def carries allOf discriminated-union branches for all 4 kinds
    allof = (md or {}).get("allOf", [])
    has_all_4_kinds = all(
        any(
            (branch.get("if", {}).get("properties", {}).get("kind", {}).get("const") == k)
            for branch in allof
        )
        for k in ("scoring", "results", "challenge", "catalog")
    )
    check(
        has_all_4_kinds,
        "definitions.module-def allOf covers all 4 kinds (scoring/results/challenge/catalog)",
    )

    # 7. definitions.scoring-config requires trait-ids (array, minItems: 1)
    sc = has(s, "definitions.scoring-config")
    trait_ids = (sc or {}).get("properties", {}).get("trait-ids", {})
    check(
        "trait-ids" in (sc or {}).get("required", [])
        and trait_ids.get("type") == "array"
        and trait_ids.get("minItems") == 1,
        "definitions.scoring-config requires trait-ids (array, minItems:1)",
    )

    # 8. definitions.results-config requires variant (enum: archetype/ranking/compatibility/score-only)
    rc = has(s, "definitions.results-config")
    variant = (rc or {}).get("properties", {}).get("variant", {})
    check(
        "variant" in (rc or {}).get("required", [])
        and set(variant.get("enum", [])) == {
            "archetype",
            "ranking",
            "compatibility",
            "score-only",
        },
        "definitions.results-config requires variant (enum: archetype/ranking/compatibility/score-only)",
    )

    # 9. definitions.challenge-config requires match-scorer (enum: exact/jaccard/weighted/scoring-diff)
    cc = has(s, "definitions.challenge-config")
    ms = (cc or {}).get("properties", {}).get("match-scorer", {})
    check(
        "match-scorer" in (cc or {}).get("required", [])
        and set(ms.get("enum", [])) == {"exact", "jaccard", "weighted", "scoring-diff"},
        "definitions.challenge-config requires match-scorer (enum: exact/jaccard/weighted/scoring-diff)",
    )

    # 10. definitions.catalog-config requires domain (pattern: kebab-case)
    catc = has(s, "definitions.catalog-config")
    domain = (catc or {}).get("properties", {}).get("domain", {})
    check(
        "domain" in (catc or {}).get("required", [])
        and domain.get("type") == "string"
        and "pattern" in domain,
        "definitions.catalog-config requires domain (string, pattern kebab-case)",
    )

    # 11. top-level additionalProperties: false is unchanged
    check(
        s.get("additionalProperties") is False,
        "top-level additionalProperties == false (existing tools[] still rejected on extra keys)",
    )

    # 12. tool-entry.additionalProperties: false is bit-identical
    te = has(s, "definitions.tool-entry")
    check(
        (te or {}).get("additionalProperties") is False,
        "definitions.tool-entry.additionalProperties == false (no accidental drift)",
    )

    # 13. existing 50 tools[] entries validate against the schema (no regressions)
    import subprocess
    tools_json = (repo_root() / "tools.json").read_text(encoding="utf-8")
    # Validate via the canonical validator.
    r = subprocess.run(
        [sys.executable, str(repo_root() / "scripts" / "validate-tools-json.py")],
        capture_output=True,
        text=True,
    )
    check(
        r.returncode == 0,
        "scripts/validate-tools-json.py exits 0 (existing 50 tools[] validate against the schema)",
    )

    exit_with_summary("DC-0")


if __name__ == "__main__":
    main()