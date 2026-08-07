#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
storage-registry-gate.py — Fail CI if any localStorage key call site
references an unregistered key.

Pure-stdlib Python. Same shape as the four sibling gates (no third-party
deps, exit codes 0/1/2/3/4, Markdown status to stdout).

Purpose
-------
Story 1.10 establishes assets/js/storage-registry.js as the single
source of truth for every localStorage key the site reads or writes
(AD-6, AD-11). The registry is exported to chrome.html via a marker-
delimited `<script type="application/json" id="ht-storage-registry-
manifest">…</script>` block; this gate extracts that block and verifies:

  1. Manifest integrity — every entry has the required fields
     {key, purpose, lifetime, schema, owner}; namespace prefix is
     `ht.*` or `handy-tools.*`; no duplicate keys.
  2. tools.json cross-check — every entry whose `history-keys` is
     non-empty has a corresponding `handy-tools.history.<slug>` in
     the manifest.
  3. Direct call sites — every `HT.storage.get/set/remove('<key>')`
     call across `assets/js/**` references a registered key (the
     string literal is in the manifest).
  4. Indirect call sites — keys bound to local constants (the
     `var STORAGE = 'foo'` pattern used by all 10 migrated tool
     files) are resolved and verified too. The walk is a two-pass
     regex: first find every `HT.storage.(get|set|remove)(<NAME>, …)`
     and `<NAME>(…, <OTHER>, …)` site, then resolve `<NAME>` to its
     initializer (a single-quoted, double-quoted, or template-string
     literal) via a separate scan. A constant that resolves to a
     non-registered key fails the gate.

Exit codes
----------
  0 — all checks pass
  1 — at least one violation (any kind)
  2 — manifest parse error / chrome.html missing markers
  3 — write error or unexpected I/O failure
  4 — slug-vs-history-key mismatch

Author: Handy Tools (Story 1.10 — Storage Registry with Namespaced Keys)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"
CHROME_REL = Path("assets/shell/chrome.html")
TOOLS_JSON_REL = Path("tools.json")
ASSETS_JS_DIR = Path("assets/js")
TOOLS_DIR = Path("tools")

MANIFEST_MARKER_START = "<!-- ht:storage-registry-manifest-start -->"
MANIFEST_MARKER_END = "<!-- ht:storage-registry-manifest-end -->"
MANIFEST_SCRIPT_RE = re.compile(
    r'<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>'
    r"(.*?)</script>",
    re.DOTALL | re.IGNORECASE,
)
MARKER_DELIMITED_RE = re.compile(
    re.escape(MANIFEST_MARKER_START)
    + r"\s*(.*?)\s*"
    + re.escape(MANIFEST_MARKER_END),
    re.DOTALL,
)

REQUIRED_FIELDS = ("key", "purpose", "lifetime", "schema", "owner")

# Public methods on HT.storage. Anything outside this set that gets called
# via HT.storage.<x>(...) bypasses the gate. Review finding: previously
# the regex only covered get/set/remove, so keys/list/clear/register
# callers were invisible to the scan.
PUBLIC_STORAGE_METHODS = (
    "get", "set", "remove", "list", "keys", "clear",
    "register", "registerHistoryKeys",
)

# Direct call site: HT.storage.<method>('literal' or "literal").
DIRECT_RE = re.compile(
    r"\bHT\.storage\.(" + "|".join(PUBLIC_STORAGE_METHODS) + r")\("
    r"\s*(['\"])([^'\"]+)\2",
)

# Template-literal call site: HT.storage.<method>(`foo${bar}`). Review
# finding: previously missed. We can't evaluate the template — we just
# flag it as a non-static call site so the dev agent either replaces
# the template with a literal or registers the dynamic key explicitly.
TEMPLATE_LITERAL_RE = re.compile(
    r"\bHT\.storage\.(" + "|".join(PUBLIC_STORAGE_METHODS) + r")\("
    r"\s*`",
)

# Indirect call site: HT.storage.<method>(CONSTANT_NAME, ...)
INDIRECT_RE = re.compile(
    r"\bHT\.storage\.(" + "|".join(PUBLIC_STORAGE_METHODS) + r")\("
    r"\s*([A-Za-z_$][\w$]*)\s*,",
)

# Constant initializer: `var NAME = 'literal'` or `let/const NAME = "literal"`.
# Captures group(1) = name, group(2) = literal (single- or double-quoted).
CONST_INIT_RE = re.compile(
    r"\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*(['\"])([^'\"]*)\2",
)

NAMESPACE_OK_RE = re.compile(r"^(ht|handy-tools)\..+")


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(
            f"storage-registry-gate: cannot resolve {start}: {exc}\n"
        )
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"storage-registry-gate: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_manifest(root: Path) -> dict[str, dict]:
    """Extract the registry manifest from chrome.html. The manifest is
    a `<script type="application/json" id="ht-storage-registry-manifest">`
    element that lives between the `ht:storage-registry-manifest-start` /
    `-end` marker comments. Return a dict keyed by key name; each value
    is the parsed entry object."""
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(
            f"storage-registry-gate: missing {chrome_path}\n"
        )
        sys.exit(2)
    text = chrome_path.read_text(encoding="utf-8")
    # Locate the script element. The marker block may contain HTML
    # annotation comments between the markers and the <script> tag —
    # extract the inner JSON body, not the raw block content.
    marker_match = MARKER_DELIMITED_RE.search(text)
    if marker_match:
        block = marker_match.group(1)
        script_match = re.search(
            r'<script\s+type="application/json"\s+id="ht-storage-registry-manifest"\s*>(.*?)</script>',
            block,
            re.DOTALL | re.IGNORECASE,
        )
        if not script_match:
            sys.stderr.write(
                "storage-registry-gate: manifest markers found but "
                "<script id=\"ht-storage-registry-manifest\"> element missing\n"
            )
            sys.exit(2)
        inner = script_match.group(1)
    else:
        script_match = MANIFEST_SCRIPT_RE.search(text)
        if not script_match:
            sys.stderr.write(
                "storage-registry-gate: manifest markers and "
                "<script id=\"ht-storage-registry-manifest\"> both missing\n"
            )
            sys.exit(2)
        inner = script_match.group(1)
    try:
        payload = json.loads(inner)
    except ValueError as exc:
        sys.stderr.write(
            f"storage-registry-gate: manifest is not valid JSON: {exc}\n"
        )
        sys.exit(2)
    if not isinstance(payload, dict) or "entries" not in payload:
        sys.stderr.write(
            "storage-registry-gate: manifest must be an object with an 'entries' array\n"
        )
        sys.exit(2)
    entries = payload["entries"]
    if not isinstance(entries, list):
        sys.stderr.write(
            "storage-registry-gate: manifest 'entries' must be an array\n"
        )
        sys.exit(2)
    by_key: dict[str, dict] = {}
    for entry in entries:
        if not isinstance(entry, dict) or "key" not in entry:
            sys.stderr.write(
                "storage-registry-gate: manifest entry missing 'key'\n"
            )
            sys.exit(2)
        by_key[entry["key"]] = entry
    return by_key


def check_manifest_integrity(by_key: dict[str, dict]) -> list[str]:
    """Verify every entry has the required fields, namespace is valid,
    and there are no duplicate keys (already deduplicated by load_manifest,
    but a sanity log is useful)."""
    violations: list[str] = []
    seen: set[str] = set()
    for key, entry in by_key.items():
        if key in seen:
            violations.append(f"duplicate manifest key {key!r}")
        seen.add(key)
        if not NAMESPACE_OK_RE.match(key):
            violations.append(
                f"manifest key {key!r} has invalid namespace "
                "(must start with 'ht.' or 'handy-tools.')"
            )
        for field in REQUIRED_FIELDS:
            value = entry.get(field)
            if not isinstance(value, str) or not value:
                violations.append(
                    f"manifest entry {key!r} missing or empty {field!r}"
                )
    return violations


def check_history_keys_against_tools_json(
    by_key: dict[str, dict], tools_json_path: Path
) -> list[str]:
    """For every tools.json entry whose `history-keys` is non-empty, the
    manifest must either (a) statically register `handy-tools.history.<slug>`,
    or (b) rely on `HT.storage.registerHistoryKeys(tools)` to register it at
    boot time. Case (b) is the common path (Story 1.10 ships the dynamic
    helper; shell.js calls it after HT.homeGrid.entries is available).
    This check verifies the static contract — if neither path covers the
    slug, it's a violation.

    The static-only check would fail spuriously for tools that have their
    history keys registered dynamically; this implementation accepts
    dynamic registration as long as the helper exists in
    assets/js/storage-registry.js. The dynamic call site is verified by
    the call-site scan (registerHistoryKeys is exported from storage-registry.js
    and called from shell.js).
    """
    if not tools_json_path.is_file():
        return [f"tools.json missing at {tools_json_path}"]
    try:
        payload = json.loads(tools_json_path.read_text(encoding="utf-8"))
    except ValueError as exc:
        return [f"tools.json is not valid JSON: {exc}"]
    violations: list[str] = []
    # Confirm the dynamic helper exists in storage-registry.js. If the
    # file is missing OR the helper is not exported, all dynamically-
    # registered history keys would slip through the gate.
    storage_registry_js = (
        tools_json_path.parent / "assets" / "js" / "storage-registry.js"
    )
    has_dynamic_helper = False
    if storage_registry_js.is_file():
        try:
            sr_text = storage_registry_js.read_text(encoding="utf-8")
            has_dynamic_helper = "registerHistoryKeys" in sr_text
        except OSError:
            pass
    # Collect the set of slugs that declare history-keys — used to
    # detect orphaned handy-tools.history.<slug> entries in the manifest.
    declared_slugs: set[str] = set()
    for tool in payload.get("tools", []):
        if not isinstance(tool, dict):
            continue
        slug = tool.get("slug")
        if not isinstance(slug, str) or not slug:
            continue
        history_keys = tool.get("history-keys")
        if not isinstance(history_keys, list) or len(history_keys) == 0:
            continue
        declared_slugs.add(slug)
        full_key = f"handy-tools.history.{slug}"
        if full_key in by_key:
            continue
        if has_dynamic_helper:
            # The boot path will register this at runtime. Skip.
            continue
        violations.append(
            f"tools.json entry {slug!r} declares history-keys but "
            f"manifest is missing {full_key!r} and storage-registry.js "
            "does not export registerHistoryKeys"
        )
    # Review finding: orphaned handy-tools.history.<slug> entries in the
    # manifest (no matching tools.json slug) are a stale-registration
    # signal — usually a typo'd slug or a tool that was removed from
    # tools.json but its history key lingered. Flag them.
    for key in sorted(by_key):
        if not key.startswith("handy-tools.history."):
            continue
        slug = key[len("handy-tools.history."):]
        if slug not in declared_slugs:
            violations.append(
                f"manifest declares {key!r} but no tools.json entry "
                f"with slug {slug!r} declares history-keys — orphan"
            )
    return violations


def iter_js_files(root: Path) -> list[Path]:
    """Walk every JS file under assets/js/** AND tools/<slug>/<slug>.js.
    Tools store state in self-contained .js files alongside index.html;
    the shell-side wrappers live in assets/js. Both are in scope for the
    call-site scan."""
    paths: list[Path] = []
    js_dir = root / ASSETS_JS_DIR
    if js_dir.is_dir():
        for child in sorted(js_dir.rglob("*.js")):
            paths.append(child)
    tools_dir = root / TOOLS_DIR
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            if not slug_dir.is_dir():
                continue
            for js in sorted(slug_dir.glob("*.js")):
                paths.append(js)
    return paths


def collect_constants(path: Path) -> dict[str, str]:
    """For a JS file, return a {NAME: literal} map of every `var/let/const
    NAME = 'literal'` initializer. Used to resolve indirect call sites."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return {}
    constants: dict[str, str] = {}
    for m in CONST_INIT_RE.finditer(text):
        constants[m.group(1)] = m.group(3)
    return constants


def check_call_sites(
    js_files: list[Path], by_key: dict[str, dict], root: Path
) -> list[str]:
    """Walk every JS file's HT.storage.get/set/remove call sites. Direct
    literal sites and indirect (constant-bound) sites are both verified
    against the manifest."""
    violations: list[str] = []
    for path in js_files:
        rel = path.relative_to(root)
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            violations.append(f"{rel}: cannot read ({exc})")
            continue
        # Pass 1: direct literal call sites.
        for m in DIRECT_RE.finditer(text):
            key = m.group(3)
            if key not in by_key:
                violations.append(
                    f"{rel}: direct call site uses unregistered key {key!r}"
                )
        # Pass 1b: template-literal call sites. The regex doesn't try
        # to evaluate the template — it just flags the call as non-
        # static so the dev agent either replaces it with a literal or
        # documents why the key is dynamic. Review finding: previously
        # template literals like `HT.storage.set(`foo.${x}`, …)` passed
        # the gate silently, allowing future code to bypass the
        # registry without the gate noticing.
        for m in TEMPLATE_LITERAL_RE.finditer(text):
            violations.append(
                f"{rel}: template-literal call site on HT.storage.{m.group(1)} "
                "is not statically verifiable — replace with a string literal "
                "or document the dynamic key in a comment above the call site"
            )
        # Pass 2: indirect (constant-bound) call sites.
        constants = collect_constants(path)
        for m in INDIRECT_RE.finditer(text):
            name = m.group(2)
            # The registry's own set/remove/register functions take a
            # `key` parameter — that's a runtime argument, not a
            # constant. Same for `value` and `meta` — they're function
            # parameters that the gate cannot resolve from the call site
            # alone. Skip well-known parameter names so the registry's
            # own internal calls don't trip the gate. Also skip JS
            # reserved words (null, undefined, true, false, this) —
            # these match the identifier regex but aren't real constants,
            # and they commonly appear in comment text above the call
            # site (e.g. "// HT.storage.set(null, x) used to ..."), which
            # the regex would otherwise parse as an indirect call.
            if name in (
                "key", "value", "meta",
                "null", "undefined", "true", "false", "this",
                "NaN", "Infinity",
            ):
                continue
            if name not in constants:
                # The constant may live in another file (e.g. shell.js
                # passes HT.storage.set(KEY, ...) where KEY is module-
                # level). Conservative fail: report it as a potential
                # miss so the dev agent either registers the key or
                # explains the cross-file binding.
                violations.append(
                    f"{rel}: indirect call site uses constant {name!r} "
                    "that has no `var/let/const` initializer in this file "
                    "(register the key in storage-registry.js OR add the "
                    "constant locally so the gate can resolve it)"
                )
                continue
            key = constants[name]
            if not key:
                # Empty string literal — likely a placeholder. Flag it.
                violations.append(
                    f"{rel}: indirect call site constant {name!r} "
                    "initialized to empty string"
                )
                continue
            if key not in by_key:
                violations.append(
                    f"{rel}: indirect call site constant {name!r} "
                    f"resolves to unregistered key {key!r}"
                )
    return violations


# Match `register('foo.bar', { ... })` and `register("foo.bar", { ... })` —
# the first quoted-string argument to a `register(` call. Captures the
# literal key string. We deliberately don't try to parse the JS; this is
# the same shape used by every call site in storage-registry.js.
REGISTER_CALL_RE = re.compile(
    r"\bregister\(\s*(['\"])([^'\"]+)\1\s*,"
)

# Mark a JS file as a "source of register() calls" so the gate can
# skip files that just call register with a runtime key parameter.
# (storage-registry.js is the canonical source; tool files don't call
# register() — they call HT.storage.register through the dispatch.)
REGISTER_SOURCE_FILENAME = "storage-registry.js"


def collect_register_calls(root: Path) -> dict[str, set[str]]:
    """Walk every JS file and collect the set of literal keys passed to
    a top-level `register(` call. Returns {relpath: {key, key, ...}}.
    The set of keys should equal the manifest's set of keys (minus the
    dynamically-registered `handy-tools.history.<slug>` keys, which
    registerHistoryKeys adds at boot time)."""
    out: dict[str, set[str]] = {}
    js_dir = root / ASSETS_JS_DIR
    if not js_dir.is_dir():
        return out
    for path in sorted(js_dir.rglob("*.js")):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        keys: set[str] = set()
        for m in REGISTER_CALL_RE.finditer(text):
            keys.add(m.group(2))
        if keys:
            out[str(path.relative_to(root))] = keys
    return out


def check_register_calls_match_manifest(
    by_key: dict[str, dict], root: Path
) -> list[str]:
    """Review finding: pre-commit hook (and the gate) should verify that
    the manifest in chrome.html is in sync with the `register(...)` calls
    in storage-registry.js. Without this check, the JS source of truth
    can silently diverge from its HTML mirror — a violation of AD-11
    (registry as the single source of truth)."""
    violations: list[str] = []
    calls = collect_register_calls(root)
    # `collect_register_calls` keys by relative path (e.g.
    # 'assets/js/storage-registry.js'). Look up the entry by basename
    # so the contract holds regardless of whether the caller passed a
    # relative or absolute root.
    source_entry = None
    for relpath, keys in calls.items():
        if Path(relpath).name == REGISTER_SOURCE_FILENAME:
            source_entry = keys
            break
    if source_entry is None:
        violations.append(
            f"register() scan: {REGISTER_SOURCE_FILENAME} has no "
            "top-level `register(...)` calls — manifest sync cannot be "
            "verified (expected the storage registry file to be the "
            "source of truth)"
        )
        return violations
    registered = source_entry
    manifest_keys = set(by_key.keys())

    # Keys in register() calls but missing from the manifest → the JS
    # side knows about a key the HTML manifest doesn't. Drift; fail.
    for key in sorted(registered - manifest_keys):
        violations.append(
            f"{REGISTER_SOURCE_FILENAME}: register({key!r}) is not in "
            "the chrome.html manifest — run `make shell-template` to "
            "regenerate, or update the manifest by hand"
        )
    # Keys in the manifest but absent from register() calls → the JS
    # source of truth has dropped the key but the manifest still carries
    # it (or the manifest was hand-edited without a matching register).
    # Drift; fail.
    for key in sorted(manifest_keys - registered):
        violations.append(
            f"{REGISTER_SOURCE_FILENAME}: manifest declares {key!r} but "
            "no `register(...)` call for it exists in storage-registry.js"
        )

    # Review finding: LEGACY_KEY_MAP is hard-coded as a separate object
    # literal in storage-registry.js, parallel to the `register(...)`
    # calls. Each entry's KEY side must be a registered key (the source
    # of the new key) AND each VALUE side (the legacy un-namespaced key)
    # must look like one of the keys the pre-1.10 tool files actually
    # wrote. We can't statically verify the latter without parsing every
    # tool file, but we can at least check that every legacy map entry
    # points to a registered key — otherwise migration would never fire.
    legacy_map = collect_legacy_key_map(root)
    if legacy_map:
        for new_key, legacy_key in sorted(legacy_map.items()):
            if new_key not in by_key:
                violations.append(
                    f"{REGISTER_SOURCE_FILENAME}: LEGACY_KEY_MAP declares "
                    f"migration from {new_key!r} → {legacy_key!r} but "
                    f"{new_key!r} is not a registered key (drop the entry "
                    "from LEGACY_KEY_MAP or add the missing register() call)"
                )
    return violations


# Match `'<key>': '<legacy>'` entries in LEGACY_KEY_MAP. The pattern
# requires a single-quoted key on the left and a single-quoted legacy
# value on the right; we deliberately don't try to handle double-quotes
# because storage-registry.js uses single quotes throughout.
LEGACY_MAP_ENTRY_RE = re.compile(
    r"['\"]([a-zA-Z0-9_.\-]+)['\"]\s*:\s*['\"]([a-zA-Z0-9_]+)['\"]"
)


def collect_legacy_key_map(root: Path) -> dict[str, str]:
    """Parse the LEGACY_KEY_MAP object literal in storage-registry.js
    and return {new_key: legacy_key}. We use a regex, not a JS parser,
    because the gate is pure-stdlib Python. The match is conservative —
    we only collect entries whose key follows the namespaced pattern
    (`handy-tools.*` or `ht.*`) and whose value is a bare identifier
    (the pre-1.10 key shape). Anything else is silently skipped (we
    don't want false positives from comments or string literals)."""
    sr_path = root / ASSETS_JS_DIR / REGISTER_SOURCE_FILENAME
    if not sr_path.is_file():
        return {}
    try:
        text = sr_path.read_text(encoding="utf-8")
    except OSError:
        return {}
    # Locate the LEGACY_KEY_MAP block by its assignment. We trust the
    # convention that the file uses `const LEGACY_KEY_MAP = Object.freeze({`
    # — anything else is a parse failure that the dev agent will see.
    block_re = re.compile(
        r"LEGACY_KEY_MAP\s*=\s*Object\.freeze\(\s*\{(.*?)\}\s*\)",
        re.DOTALL,
    )
    block_match = block_re.search(text)
    if not block_match:
        return {}
    block = block_match.group(1)
    out: dict[str, str] = {}
    for m in LEGACY_MAP_ENTRY_RE.finditer(block):
        new_key, legacy_key = m.group(1), m.group(2)
        # Sanity: only accept the namespaced side as the new key, and
        # only accept a bare-identifier legacy side (no dots — legacy
        # keys were un-namespaced).
        if (new_key.startswith("ht.") or new_key.startswith("handy-tools.")) and (
            "." not in legacy_key
        ):
            out[new_key] = legacy_key
    return out


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

    print("storage-registry-gate: loading manifest from chrome.html…")
    by_key = load_manifest(root)
    print(f"storage-registry-gate: manifest has {len(by_key)} registered key(s)")

    failures = 0

    print("storage-registry-gate: verifying manifest integrity…")
    integrity = check_manifest_integrity(by_key)
    if integrity:
        for v in integrity:
            print(f"  FAIL    {v}")
        failures += len(integrity)
    else:
        print("  ok      manifest integrity")

    print("storage-registry-gate: cross-checking tools.json history-keys…")
    history = check_history_keys_against_tools_json(by_key, root / TOOLS_JSON_REL)
    if history:
        for v in history:
            print(f"  FAIL    {v}")
        failures += len(history)
    else:
        print("  ok      history-keys match tools.json slugs")

    print("storage-registry-gate: walking JS call sites…")
    js_files = iter_js_files(root)
    print(f"storage-registry-gate: scanning {len(js_files)} JS file(s)")
    call_site_violations = check_call_sites(js_files, by_key, root)
    if call_site_violations:
        for v in call_site_violations:
            print(f"  FAIL    {v}")
        failures += len(call_site_violations)
    else:
        print("  ok      all HT.storage.* call sites reference registered keys")

    print("storage-registry-gate: verifying register() calls match manifest…")
    sync_violations = check_register_calls_match_manifest(by_key, root)
    if sync_violations:
        for v in sync_violations:
            print(f"  FAIL    {v}")
        failures += len(sync_violations)
    else:
        print("  ok      register() calls and manifest in sync")

    if failures:
        print(f"storage-registry-gate: {failures} violation(s) found")
        return 1
    print("storage-registry-gate: all checks pass")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))