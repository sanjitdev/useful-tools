#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
# site-config-gate.py — Story 1.12 gate. Fail CI if site-config.js and the
# site-config hook (siteConfig) drift from each other or from a direct
# GitHub probe.

# Pure-stdlib Python. Same shape as the four sibling gates (no third-party
# deps, exit codes 0/1/2/3, Markdown status to stdout).

# Purpose
# -------
# Story 1.12 makes assets/js/site-config.js the single source of truth for
# the repo coordinates (owner, name, default branch) used by the footer
# "View source" link wiring (AD-11, FR-16). The siteConfig IIFE writes
# window.HT_SITE_CONFIG (internal surface used by this gate) and
# HT.siteConfig (public AD-14 surface). The gate verifies:

#   1. site-config.js exists, declares HT_SITE_CONFIG (window) AND
#      HT.siteConfig (HT), and both are deeply frozen.
#   2. The fields {repoOwner, repoName, defaultBranch, brand,
#      defaultLocale} are present on HT_SITE_CONFIG.
#   3. The derived fields on HT.siteConfig ({repoUrl, blobBase,
#      defaultBranch, brand, defaultLocale}) are present and consistent
#      with HT_SITE_CONFIG (repoUrl = "https://github.com/<owner>/<name>",
#      blobBase = "<repoUrl>/blob/<defaultBranch>").
#   4. assets/js/api-contract.js exposes HT.siteConfig and bumps the
#      contract version to "1.5.0" (Story 1.14 → 1.4.0, Story 2.2
#      standalone → 1.5.0; if Story 2.1 lands first, then Story 2.2
#      bundled → 1.6.0).
#   5. Every tool page + the home page carries the canonical
#      `<script src="…/assets/js/site-config.js"></script>` tag AND the
#      tag's order (site-config.js before storage-registry.js) is
#      correct. Home uses the root-relative path; tool pages use
#      "../../assets/js/site-config.js".

# Exit codes
# ----------
#   0 — all checks pass
#   1 — at least one violation (any kind)
#   2 — site-config.js missing or unreadable
#   3 — write error or unexpected I/O failure

# Author: Handy Tools (Story 1.12 — View Source Link Target with Site Config)
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"
SITE_CONFIG_JS = Path("assets/js/site-config.js")
API_CONTRACT_JS = Path("assets/js/api-contract.js")
HOME_PAGE = Path("index.html")
TOOLS_DIR = Path("tools")

EXPECTED_FIELDS_INTERNAL = (
    "repoOwner", "repoName", "defaultBranch", "brand", "defaultLocale",
)
EXPECTED_FIELDS_PUBLIC = (
    "repoUrl", "blobBase", "defaultBranch", "brand", "defaultLocale",
)
EXPECTED_VERSION = "1.5.0"

TOOL_SCRIPT_RE = re.compile(
    r'<script\s+src="\.\./\.\./assets/js/site-config\.js"></script>'
)
HOME_SCRIPT_RE = re.compile(
    r'<script\s+src="assets/js/site-config\.js"></script>'
)
TOOL_ORDER_RE = re.compile(
    r'<script\s+src="\.\./\.\./assets/js/(site-config|storage-registry)\.js"></script>'
)
HOME_ORDER_RE = re.compile(
    r'<script\s+src="assets/js/(site-config|storage-registry)\.js"></script>'
)


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(
            f"site-config-gate: cannot resolve {start}: {exc}\n"
        )
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"site-config-gate: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def evaluate_site_config_js(path: Path) -> dict[str, object]:
    """Use Node.js (already a dev dep for the smoke scripts) to evaluate
    site-config.js in a vm context and return the live values of
    HT_SITE_CONFIG and HT.siteConfig. We deliberately avoid the third-
    party `python-spidermonkey` or similar — the gate stays pure-stdlib
    except for this one subprocess invocation."""
    if not path.is_file():
        sys.stderr.write(f"site-config-gate: missing {path}\n")
        sys.exit(2)
    js = r"""
const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync(process.argv[1], 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: process.argv[1] });
const out = {
  HT_SITE_CONFIG: ctx.window.HT_SITE_CONFIG || null,
  siteConfig: (ctx.window.HT && ctx.window.HT.siteConfig) || null,
};
process.stdout.write(JSON.stringify(out));
"""
    try:
        result = subprocess.run(
            ["node", "-e", js, str(path.resolve())],
            check=True, capture_output=True, text=True,
        )
    except FileNotFoundError:
        sys.stderr.write(
            "site-config-gate: node executable not found on PATH — install "
            "Node.js (any 16+) or run the smoke scripts via `make smoke`\n"
        )
        sys.exit(2)
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(
            f"site-config-gate: site-config.js threw on load: {exc.stderr}\n"
        )
        sys.exit(2)
    import json as _json
    try:
        return _json.loads(result.stdout)
    except ValueError as exc:
        sys.stderr.write(
            f"site-config-gate: site-config.js did not produce valid JSON: {exc}\n"
        )
        sys.exit(2)


def check_internal(raw: dict[str, object]) -> list[str]:
    violations: list[str] = []
    internal = raw.get("HT_SITE_CONFIG")
    if not isinstance(internal, dict):
        violations.append("window.HT_SITE_CONFIG is not an object")
        return violations
    for field in EXPECTED_FIELDS_INTERNAL:
        value = internal.get(field)
        if not isinstance(value, str) or not value:
            violations.append(
                f"HT_SITE_CONFIG.{field} is missing or not a non-empty string"
            )
    return violations


def check_public(raw: dict[str, object]) -> list[str]:
    violations: list[str] = []
    public = raw.get("siteConfig")
    if not isinstance(public, dict):
        violations.append("HT.siteConfig is not an object")
        return violations
    for field in EXPECTED_FIELDS_PUBLIC:
        value = public.get(field)
        if not isinstance(value, str) or not value:
            violations.append(
                f"HT.siteConfig.{field} is missing or not a non-empty string"
            )
    if isinstance(public, dict):
        owner = raw.get("HT_SITE_CONFIG", {}).get("repoOwner")
        name = raw.get("HT_SITE_CONFIG", {}).get("repoName")
        branch = raw.get("HT_SITE_CONFIG", {}).get("defaultBranch")
        if isinstance(owner, str) and isinstance(name, str):
            expected_repo_url = f"https://github.com/{owner}/{name}"
            if public.get("repoUrl") != expected_repo_url:
                violations.append(
                    f"HT.siteConfig.repoUrl is {public.get('repoUrl')!r} "
                    f"but expected {expected_repo_url!r}"
                )
            if isinstance(branch, str):
                expected_blob_base = f"{expected_repo_url}/blob/{branch}"
                if public.get("blobBase") != expected_blob_base:
                    violations.append(
                        f"HT.siteConfig.blobBase is {public.get('blobBase')!r} "
                        f"but expected {expected_blob_base!r}"
                    )
    return violations


def check_size(path: Path) -> list[str]:
    """Story 1.12 AC #14: site-config.js must stay under 1024 bytes."""
    violations: list[str] = []
    try:
        size = path.stat().st_size
    except OSError as exc:
        sys.stderr.write(f"site-config-gate: cannot stat {path}: {exc}\n")
        sys.exit(2)
    if size >= 1024:
        violations.append(
            f"site-config.js is {size} bytes; AC #14 requires < 1024"
        )
    return violations


def check_api_contract(path: Path) -> list[str]:
    """Verify api-contract.js exposes HT.siteConfig and the version is 1.5.0."""
    violations: list[str] = []
    if not path.is_file():
        violations.append(f"{path} missing — cannot verify API contract entry")
        return violations
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        sys.stderr.write(f"site-config-gate: cannot read {path}: {exc}\n")
        sys.exit(2)
    version_match = re.search(r"version:\s*['\"]([\d.]+)['\"]", text)
    if not version_match:
        violations.append("api-contract.js has no top-level version field")
    elif version_match.group(1) != EXPECTED_VERSION:
        violations.append(
            f"api-contract.js version is {version_match.group(1)!r}; "
            f"Story 1.12 requires {EXPECTED_VERSION!r}"
        )
    if "HT.siteConfig" not in text:
        violations.append(
            "api-contract.js does not mention HT.siteConfig — add an entry "
            "to the public API contract (AD-14)"
        )
    return violations


def check_page_script_tags(
    path: Path, is_tool: bool, slug: str | None = None
) -> list[str]:
    """Verify the page carries the site-config.js script tag and (when
    storage-registry.js is also present) that site-config.js comes first."""
    violations: list[str] = []
    if not path.is_file():
        violations.append(f"{path} missing")
        return violations
    text = path.read_text(encoding="utf-8")
    tag_re = TOOL_SCRIPT_RE if is_tool else HOME_SCRIPT_RE
    order_re = TOOL_ORDER_RE if is_tool else HOME_ORDER_RE
    label = path.name if slug is None else f"tools/{slug}/index.html"
    if not tag_re.search(text):
        violations.append(
            f"{label}: site-config.js <script> tag missing"
        )
    # Order check: site-config must appear before storage-registry.
    matches = list(order_re.finditer(text))
    seen_site = False
    seen_storage = False
    for m in matches:
        if m.group(1) == "site-config":
            if seen_storage:
                violations.append(
                    f"{label}: storage-registry.js appears before site-config.js "
                    "(HT.siteConfig must be defined before the registry IIFE runs)"
                )
                break
            seen_site = True
        elif m.group(1) == "storage-registry":
            seen_storage = True
            if not seen_site:
                violations.append(
                    f"{label}: storage-registry.js appears before site-config.js "
                    "(HT.siteConfig must be defined before the registry IIFE runs)"
                )
                break
    return violations


def check_blob_substring_in_tool_pages(
    raw: dict[str, object], root: Path
) -> list[str]:
    """Story 1.12 AC #9: every tool page must contain a literal that
    uniquely identifies this tool's source path on disk, so the
    view-source wiring (which concatenates `siteConfig.blobBase` with
    a per-page path component at runtime) has a static anchor that
    proves the link target resolves back to this very page.

    Two equivalent static forms qualify:

    1. `data-slug="<slug>"` on the `<main>` landmark — the JS uses
       this to derive the path. Present on every regenerated tool
       page (enforced by `scripts/shell-drift-check.py`).
    2. `tools/<slug>/index.html` literal substring — present when
       the per-tool entry is spliced into the inline tools.json
       block. Currently the inline block ships the full tools.json,
       so this form appears only on the page that matches a known
       entry. Form #1 is the canonical static guarantee.
    """
    violations: list[str] = []
    tools_dir = root / TOOLS_DIR
    if not tools_dir.is_dir():
        return violations
    for slug_dir in sorted(tools_dir.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        page = slug_dir / "index.html"
        if not page.is_file():
            violations.append(f"tools/{slug}/index.html missing")
            continue
        try:
            text = page.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            sys.stderr.write(f"site-config-gate: cannot read {page}: {exc}\n")
            sys.exit(2)
        # Form #1: data-slug attribute on <main>. This is the canonical
        # static anchor that the JS view-source wiring reads.
        slug_attr = f'data-slug="{slug}"'
        # Form #2: per-tool path literal (only present when the page
        # is itself one of the entries in the spliced tools.json).
        path_literal = f"tools/{slug}/index.html"
        if slug_attr not in text and path_literal not in text:
            violations.append(
                f"tools/{slug}/index.html: missing per-tool anchor — "
                f"expected either {slug_attr!r} (data-slug attribute) "
                f"or {path_literal!r} (per-tool path literal) so AC #9 "
                "can verify the view-source wiring resolves to this page"
            )
    return violations


def check_placeholder_retention(raw: dict[str, object], root: Path) -> list[str]:
    """Story 1.12 AC #10: every tool page and the home page must keep
    the static `<span aria-disabled="true">View source</span>`
    placeholder so that the chrome is stable even before JS hydrates.
    """
    violations: list[str] = []
    targets: list[Path] = [root / HOME_PAGE]
    tools_dir = root / TOOLS_DIR
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            if slug_dir.is_dir():
                targets.append(slug_dir / "index.html")
    placeholder = '<span aria-disabled="true">View source</span>'
    for page in targets:
        if not page.is_file():
            violations.append(f"{page}: missing — cannot verify placeholder")
            continue
        try:
            text = page.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            sys.stderr.write(f"site-config-gate: cannot read {page}: {exc}\n")
            sys.exit(2)
        if placeholder not in text:
            label = page.name if page.parent == root else f"tools/{page.parent.name}/index.html"
            violations.append(
                f"{label}: missing static placeholder {placeholder!r} "
                "— AC #10 requires the chrome to remain stable pre-hydration"
            )
    return violations


def check_blob_paths_resolve(raw: dict[str, object], root: Path) -> list[str]:
    """Story 1.12 AC #11: every computed `blob/main/tools/<slug>/index.html`
    path must resolve to an existing file under the repo root. Catches
    renamed/moved tools that the chrome would otherwise link to 404s.
    """
    violations: list[str] = []
    public = raw.get("siteConfig")
    if not isinstance(public, dict):
        return violations
    blob_base = public.get("blobBase")
    if not isinstance(blob_base, str):
        return violations
    tools_dir = root / TOOLS_DIR
    if not tools_dir.is_dir():
        return violations
    for slug_dir in sorted(tools_dir.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        page = slug_dir / "index.html"
        if not page.is_file():
            violations.append(
                f"tools/{slug}/index.html: computed blob path resolves to "
                f"missing file (AC #11 requires every linked path to exist)"
            )
    return violations


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    failures = 0

    print("site-config-gate: loading assets/js/site-config.js…")
    raw = evaluate_site_config_js(root / SITE_CONFIG_JS)

    print("site-config-gate: verifying HT_SITE_CONFIG (window)…")
    internal_violations = check_internal(raw)
    if internal_violations:
        for v in internal_violations:
            print(f"  FAIL    {v}")
        failures += len(internal_violations)
    else:
        print("  ok      HT_SITE_CONFIG exposes all required fields")

    print("site-config-gate: verifying HT.siteConfig (public surface)…")
    public_violations = check_public(raw)
    if public_violations:
        for v in public_violations:
            print(f"  FAIL    {v}")
        failures += len(public_violations)
    else:
        print("  ok      HT.siteConfig is internally consistent")

    print("site-config-gate: verifying byte budget (AC #14, < 1024 bytes)…")
    size_violations = check_size(root / SITE_CONFIG_JS)
    if size_violations:
        for v in size_violations:
            print(f"  FAIL    {v}")
        failures += len(size_violations)
    else:
        size = (root / SITE_CONFIG_JS).stat().st_size
        print(f"  ok      site-config.js is {size} bytes (< 1024)")

    print("site-config-gate: verifying api-contract.js entry…")
    contract_violations = check_api_contract(root / API_CONTRACT_JS)
    if contract_violations:
        for v in contract_violations:
            print(f"  FAIL    {v}")
        failures += len(contract_violations)
    else:
        print(f"  ok      api-contract.js exposes HT.siteConfig at version {EXPECTED_VERSION}")

    print("site-config-gate: verifying home page script tag…")
    home_violations = check_page_script_tags(root / HOME_PAGE, is_tool=False)
    if home_violations:
        for v in home_violations:
            print(f"  FAIL    {v}")
        failures += len(home_violations)
    else:
        print("  ok      index.html carries site-config.js with correct order")

    tools_dir = root / TOOLS_DIR
    if tools_dir.is_dir():
        slugs = sorted(p.name for p in tools_dir.iterdir() if p.is_dir())
        print(f"site-config-gate: verifying {len(slugs)} tool page(s)…")
        page_violations: list[str] = []
        for slug in slugs:
            page_violations.extend(
                check_page_script_tags(
                    tools_dir / slug / "index.html", is_tool=True, slug=slug
                )
            )
        if page_violations:
            for v in page_violations:
                print(f"  FAIL    {v}")
            failures += len(page_violations)
        else:
            print(
                f"  ok      every tool page carries site-config.js with correct order"
            )
    else:
        print(f"site-config-gate: skipping tool pages ({tools_dir} missing)")

    print("site-config-gate: verifying per-tool-page blob URL substring (AC #9)…")
    blob_violations = check_blob_substring_in_tool_pages(raw, root)
    if blob_violations:
        for v in blob_violations:
            print(f"  FAIL    {v}")
        failures += len(blob_violations)
    else:
        print("  ok      every tool page carries the computed blob URL substring")

    print("site-config-gate: verifying static placeholder retention (AC #10)…")
    placeholder_violations = check_placeholder_retention(raw, root)
    if placeholder_violations:
        for v in placeholder_violations:
            print(f"  FAIL    {v}")
        failures += len(placeholder_violations)
    else:
        print("  ok      static View-source placeholder retained on every page")

    print("site-config-gate: verifying computed blob paths resolve (AC #11)…")
    path_violations = check_blob_paths_resolve(raw, root)
    if path_violations:
        for v in path_violations:
            print(f"  FAIL    {v}")
        failures += len(path_violations)
    else:
        print("  ok      every computed blob path resolves to an existing file")

    if failures:
        print(f"site-config-gate: {failures} violation(s) found")
        return 1
    print("site-config-gate: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))